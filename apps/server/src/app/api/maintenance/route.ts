import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MOCK_USER_ID } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const { action } = await request.json();

    if (action === 'empty_trash') {
      const result = await prisma.bookmark.deleteMany({
        where: { userId: MOCK_USER_ID, status: 'TRASH' }
      });
      return NextResponse.json({
        success: true,
        message: `废纸篓已清空，彻底粉碎了 ${result.count} 条记录`
      });
    }

    if (action === 'deduplicate') {
      const bookmarks = await prisma.bookmark.findMany({
        where: { userId: MOCK_USER_ID, status: 'ACTIVE' },
        include: { tags: true }
      });

      const urlMap: { [url: string]: typeof bookmarks } = {};
      for (const bm of bookmarks) {
        if (!urlMap[bm.url]) urlMap[bm.url] = [];
        urlMap[bm.url].push(bm);
      }

      let mergedCount = 0;
      for (const [_, list] of Object.entries(urlMap)) {
        if (list.length > 1) {
          const keep = list[0];
          const duplicates = list.slice(1);
          // 合并标签
          const allTags = Array.from(new Set(list.flatMap(item => item.tags.map(t => t.name))));
          await prisma.bookmark.update({
            where: { id: keep.id },
            data: {
              tags: {
                connectOrCreate: allTags.map(name => ({
                  where: { name_userId: { name, userId: MOCK_USER_ID } },
                  create: { name, userId: MOCK_USER_ID }
                }))
              }
            }
          });
          // 物理删除重复条目
          for (const d of duplicates) {
            await prisma.bookmark.delete({ where: { id: d.id } });
            mergedCount++;
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: mergedCount > 0 ? `扫描完毕，成功清理并合并了 ${mergedCount} 条重复书签！` : '书签库非常健康，未发现任何重复项目！'
      });
    }

    return NextResponse.json({ success: false, error: '未知维护动作' }, { status: 400 });
  } catch (error: any) {
    console.error('Maintenance action failed:', error);
    return NextResponse.json({ success: false, error: error.message || '操作失败' }, { status: 500 });
  }
}
