import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MOCK_USER_ID } from '@/lib/constants';

// GET /api/export 导出标准 Netscape 书签 HTML 文件
export async function GET() {
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: MOCK_USER_ID, status: 'ACTIVE' },
      include: { collection: true, tags: true },
      orderBy: { createdAt: 'desc' }
    });

    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

    for (const bm of bookmarks) {
      const addDate = Math.floor(new Date(bm.createdAt).getTime() / 1000);
      const tagsAttr = bm.tags.map(t => t.name).join(',');
      html += `    <DT><A HREF="${bm.url}" ADD_DATE="${addDate}" TAGS="${tagsAttr}">${bm.title || bm.url}</A>\n`;
    }

    html += `</DL><p>\n`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'attachment; filename="o-marker-bookmarks.html"'
      }
    });
  } catch (error: any) {
    console.error('Export failed:', error);
    return NextResponse.json({ success: false, error: '导出书签失败' }, { status: 500 });
  }
}
