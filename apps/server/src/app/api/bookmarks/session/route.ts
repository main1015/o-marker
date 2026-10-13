import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MOCK_USER_ID } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tabs } = body;

    if (!tabs || !Array.isArray(tabs) || tabs.length === 0) {
      return NextResponse.json({ success: false, error: '请提供有效的标签页数据' }, { status: 400 });
    }

    // 1. 过滤内部页面并按规范化 URL 去重
    const uniqueTabsMap = new Map<string, { url: string; title?: string; favIconUrl?: string }>();
    for (const tab of tabs) {
      if (!tab.url || typeof tab.url !== 'string') continue;
      const cleanUrl = tab.url.trim();

      // 只保留有效的 HTTP/HTTPS 外部页面
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) continue;

      // 过滤控制台或本地管理页面
      try {
        const parsed = new URL(cleanUrl);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          if (parsed.port === '7364' || parsed.port === '3000') continue;
        }
      } catch {
        continue;
      }

      if (!uniqueTabsMap.has(cleanUrl)) {
        uniqueTabsMap.set(cleanUrl, {
          url: cleanUrl,
          title: tab.title?.trim() || cleanUrl,
          favIconUrl: tab.favIconUrl
        });
      }
    }

    const validTabs = Array.from(uniqueTabsMap.values());
    if (validTabs.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '未发现可保存的有效网页（已自动过滤内部系统与空白页）' 
      }, { status: 400 });
    }

    // 2. 查重优先：检查哪些网址已存在于数据库中
    const urlsToSave = validTabs.map(t => t.url);
    const existingBookmarks = await prisma.bookmark.findMany({
      where: {
        userId: MOCK_USER_ID,
        url: { in: urlsToSave },
        status: { not: 'TRASH' }
      }
    });

    const existingMap = new Map(existingBookmarks.map(b => [b.url, b]));
    const newTabs = validTabs.filter(tab => !existingMap.has(tab.url));
    const now = new Date();

    // 3. 核心判定：如果没有全新的书签，坚决不创建会话快照文件夹！
    if (newTabs.length === 0) {
      // 仅批量刷新已存在书签的访问时间
      await prisma.bookmark.updateMany({
        where: {
          id: { in: existingBookmarks.map(b => b.id) }
        },
        data: {
          lastVisitedAt: now
        }
      });

      return NextResponse.json({ 
        success: true, 
        data: {
          collection: null,
          totalTabs: validTabs.length,
          newCreatedCount: 0,
          reusedCount: existingBookmarks.length,
          noNewTabs: true
        } 
      });
    }

    // 4. 有新书签需要保存时，才创建会话快照文件夹 (带 10 秒防连击复用)
    const tenSecondsAgo = new Date(Date.now() - 10000);
    let collection = await prisma.collection.findFirst({
      where: {
        userId: MOCK_USER_ID,
        name: { startsWith: '会话快照:' },
        createdAt: { gte: tenSecondsAgo }
      }
    });

    if (!collection) {
      const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const SESSION_COLLECTION_NAME = `会话快照: ${timeStr}`;

      collection = await prisma.collection.create({
        data: {
          name: SESSION_COLLECTION_NAME,
          user: {
            connectOrCreate: {
              where: { id: MOCK_USER_ID },
              create: {
                id: MOCK_USER_ID,
                email: 'test@omarker.com',
                passwordHash: 'dummy-hash'
              }
            }
          }
        }
      });
    }

    // 5. 写入全新书签，并关联到该会话快照文件夹
    const creationPromises = newTabs.map(tab => {
      return prisma.bookmark.create({
        data: {
          url: tab.url,
          title: tab.title,
          coverImg: tab.favIconUrl,
          userId: MOCK_USER_ID,
          collectionId: collection.id,
          lastVisitedAt: now
        }
      });
    });

    // 针对已有书签，如果之前未分配任何文件夹，可以关联到该快照
    const updateExistingPromises = existingBookmarks.map(b => {
      return prisma.bookmark.update({
        where: { id: b.id },
        data: {
          collectionId: b.collectionId || collection.id,
          lastVisitedAt: now
        }
      });
    });

    await Promise.all([...creationPromises, ...updateExistingPromises]);

    return NextResponse.json({ 
      success: true, 
      data: {
        collection,
        totalTabs: validTabs.length,
        newCreatedCount: newTabs.length,
        reusedCount: existingBookmarks.length,
        noNewTabs: false
      } 
    });
  } catch (error) {
    console.error('Failed to save session:', error);
    return NextResponse.json({ success: false, error: '保存会话失败' }, { status: 500 });
  }
}
