import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MOCK_USER_ID } from '@/lib/constants';

// POST /api/import 接收 HTML 书签文件并批量导入
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: '请选择书签 HTML 文件' }, { status: 400 });
    }

    const html = await file.text();
    // 正则提取所有 <A HREF="...">Title</A>
    const regex = /<A\s+[^>]*HREF=["']([^"']+)["'][^>]*>(.*?)<\/A>/gi;
    let match: RegExpExecArray | null;
    const items: { url: string; title: string }[] = [];

    while ((match = regex.exec(html)) !== null) {
      const url = match[1]?.trim();
      const title = match[2]?.trim().replace(/<[^>]+>/g, '') || url;
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        items.push({ url, title });
      }
    }

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: '未在该文件中解析出有效网页链接' }, { status: 400 });
    }

    // 查出该用户已有活跃书签
    const existing = await prisma.bookmark.findMany({
      where: { userId: MOCK_USER_ID, status: 'ACTIVE' },
      select: { url: true }
    });
    const existingUrls = new Set(existing.map(e => e.url));

    let importedCount = 0;
    for (const item of items) {
      if (!existingUrls.has(item.url)) {
        await prisma.bookmark.create({
          data: {
            url: item.url,
            title: item.title,
            userId: MOCK_USER_ID,
            status: 'ACTIVE'
          }
        });
        existingUrls.add(item.url);
        importedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `成功解析 ${items.length} 个书签，新增导入 ${importedCount} 个新书签 (忽略 ${items.length - importedCount} 个重复项)`,
      totalFound: items.length,
      importedCount
    });
  } catch (error: any) {
    console.error('Import failed:', error);
    return NextResponse.json({ success: false, error: error.message || '导入失败' }, { status: 500 });
  }
}
