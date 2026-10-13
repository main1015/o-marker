import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MOCK_USER_ID } from '@/lib/constants';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    // 若指定了 url 查询参数，精准返回该网址的书签记录 (包括 ACTIVE 和 TRASH)
    if (targetUrl) {
      const found = await prisma.bookmark.findFirst({
        where: { userId: MOCK_USER_ID, url: targetUrl },
        include: { tags: true, collection: true }
      });

      if (found && found.status === 'ACTIVE') {
        const now = new Date();
        // 异步更新最近访问时间
        prisma.bookmark.update({
          where: { id: found.id },
          data: { lastVisitedAt: now }
        }).catch((err) => console.warn('Update lastVisitedAt failed:', err));

        return NextResponse.json({ 
          success: true, 
          data: { 
            ...found, 
            lastVisitedAt: found.lastVisitedAt || now 
          } 
        });
      }

      return NextResponse.json({ success: true, data: found });
    }

    // 过滤与搜索参数
    const filter = searchParams.get('filter') || 'all';
    const collectionId = searchParams.get('collectionId');
    const tag = searchParams.get('tag');
    const q = searchParams.get('q')?.trim();

    // 构建 Prisma 查询条件
    const whereClause: any = { userId: MOCK_USER_ID, status: 'ACTIVE' };

    if (filter === 'unclassified') {
      whereClause.collectionId = null;
    } else if (filter === 'favorites') {
      whereClause.isFavorite = true;
    } else if (filter === 'trash') {
      whereClause.status = 'TRASH';
    }

    if (collectionId) {
      whereClause.collectionId = collectionId;
    }

    if (tag) {
      whereClause.tags = { some: { name: tag } };
    }

    if (q) {
      whereClause.OR = [
        { title: { contains: q } },
        { url: { contains: q } },
        { description: { contains: q } },
        { tags: { some: { name: { contains: q } } } }
      ];
    }

    // 分页计算 (由常量中心统一管控默认与最大条数)
    const pageNum = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limitNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10)));
    const skip = (pageNum - 1) * limitNum;

    const [total, bookmarks] = await Promise.all([
      prisma.bookmark.count({ where: whereClause }),
      prisma.bookmark.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          tags: true,
          collection: true,
        }
      })
    ]);

    return NextResponse.json({ 
      success: true, 
      data: bookmarks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        hasMore: skip + bookmarks.length < total
      }
    });
  } catch (error) {
    console.error('Failed to fetch bookmarks:', error);
    return NextResponse.json({ success: false, error: '获取书签失败' }, { status: 500 });
  }
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, title, description, coverImg, tags, collectionId, isFavorite } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL 不能为空' }, { status: 400 });
    }

    // 自动创建或连接对应的标签记录
    const tagsConnectOrCreate = tags ? tags.map((tagName: string) => ({
      where: { name_userId: { name: tagName, userId: MOCK_USER_ID } },
      create: { name: tagName, userId: MOCK_USER_ID }
    })) : [];

    // 查重：检查该用户是否已有该 URL 的有效书签
    const existing = await prisma.bookmark.findFirst({
      where: {
        userId: MOCK_USER_ID,
        url,
        status: { not: 'TRASH' }
      },
      include: { tags: true }
    });

    if (existing) {
      // 存在则执行智能合并 (Merge)
      const updateData: any = {};
      if (title) updateData.title = title;
      if (description) updateData.description = description;
      if (coverImg) updateData.coverImg = coverImg;
      if (collectionId !== undefined) {
        if (collectionId) {
          updateData.collection = { connect: { id: collectionId } };
        } else {
          updateData.collection = { disconnect: true };
        }
      }
      if (isFavorite !== undefined) updateData.isFavorite = Boolean(isFavorite);

      if (tagsConnectOrCreate.length > 0) {
        updateData.tags = {
          connectOrCreate: tagsConnectOrCreate
        };
      }

      const updated = await prisma.bookmark.update({
        where: { id: existing.id },
        data: updateData,
        include: { tags: true, collection: true }
      });

      return NextResponse.json({ 
        success: true, 
        message: '该书签已存在，已更新现有书签', 
        data: updated,
        isMerged: true 
      });
    }

    const bookmark = await prisma.bookmark.create({
      data: {
        url,
        title,
        description,
        coverImg,
        isFavorite: isFavorite ? Boolean(isFavorite) : false,
        lastVisitedAt: new Date(),
        collection: collectionId ? { connect: { id: collectionId } } : undefined,
        user: {
          connectOrCreate: {
            where: { id: MOCK_USER_ID },
            create: {
              id: MOCK_USER_ID,
              email: 'test@omarker.com',
              passwordHash: 'dummy-hash'
            }
          }
        },
        tags: {
          connectOrCreate: tagsConnectOrCreate
        }
      },
      include: {
        tags: true,
        collection: true
      }
    });

    return NextResponse.json({ success: true, data: bookmark });
  } catch (error: any) {
    console.error('Failed to create bookmark:', error);
    return NextResponse.json({ success: false, error: error?.message || '保存书签失败' }, { status: 500 });
  }
}

// DELETE /api/bookmarks (批量删除/移入废纸篓/清空废纸篓)
export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { ids, permanent = false, emptyTrash = false } = body;

    // 一键清空废纸篓
    if (emptyTrash) {
      const result = await prisma.bookmark.deleteMany({
        where: { userId: MOCK_USER_ID, status: 'TRASH' }
      });
      return NextResponse.json({ 
        success: true, 
        count: result.count, 
        message: '已彻底清空废纸篓' 
      });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '请提供要删除的书签 ID 列表 (ids)' 
      }, { status: 400 });
    }

    // 批量彻底删除 (物理硬删除)
    if (permanent) {
      const result = await prisma.bookmark.deleteMany({
        where: {
          userId: MOCK_USER_ID,
          id: { in: ids }
        }
      });
      return NextResponse.json({ 
        success: true, 
        count: result.count, 
        message: '已彻底删除所选书签' 
      });
    }

    // 批量移入废纸篓 (软删除，默认安全行为)
    const result = await prisma.bookmark.updateMany({
      where: {
        userId: MOCK_USER_ID,
        id: { in: ids }
      },
      data: {
        status: 'TRASH'
      }
    });

    return NextResponse.json({ 
      success: true, 
      count: result.count, 
      message: '已成功将所选书签移入废纸篓' 
    });
  } catch (error: any) {
    console.error('Failed to batch delete bookmarks:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || '批量删除书签失败' 
    }, { status: 500 });
  }
}

// PATCH /api/bookmarks (批量更新/批量恢复)
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { ids, action, collectionId } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '请提供要操作的书签 ID 列表 (ids)' 
      }, { status: 400 });
    }

    // 批量从废纸篓恢复
    if (action === 'restore') {
      const result = await prisma.bookmark.updateMany({
        where: {
          userId: MOCK_USER_ID,
          id: { in: ids }
        },
        data: {
          status: 'ACTIVE'
        }
      });
      return NextResponse.json({ 
        success: true, 
        count: result.count, 
        message: '已成功从废纸篓恢复所选书签' 
      });
    }

    // 批量移动文件夹
    if (collectionId !== undefined) {
      const result = await prisma.bookmark.updateMany({
        where: {
          userId: MOCK_USER_ID,
          id: { in: ids }
        },
        data: {
          collectionId: collectionId || null
        }
      });
      return NextResponse.json({ 
        success: true, 
        count: result.count, 
        message: '已成功批量变更所属文件夹' 
      });
    }

    return NextResponse.json({ success: false, error: '未知的批量操作动作' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to batch update bookmarks:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || '批量更新书签失败' 
    }, { status: 500 });
  }
}

