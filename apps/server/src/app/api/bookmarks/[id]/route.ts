import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MOCK_USER_ID } from '@/lib/constants';

// PATCH /api/bookmarks/[id]
// 支持同时更新标题、网址、备注描述、文件夹、标签、收藏标记、状态(恢复/软删除)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, tags, title, url, description, collectionId, isFavorite } = body;

    const updateData: any = {};

    // 动作：从回收站恢复或放入回收站
    if (action === 'restore') {
      updateData.status = 'ACTIVE';
    } else if (action === 'trash') {
      updateData.status = 'TRASH';
    }

    // 常规字段更新
    if (title !== undefined) updateData.title = typeof title === 'string' ? title.trim() : null;
    if (url !== undefined) updateData.url = typeof url === 'string' ? url.trim() : '';
    if (description !== undefined) {
      updateData.description = typeof description === 'string' ? description.trim() : null;
    }
    if (collectionId !== undefined) {
      if (collectionId) {
        updateData.collection = { connect: { id: collectionId } };
      } else {
        updateData.collection = { disconnect: true };
      }
    }
    if (isFavorite !== undefined) {
      updateData.isFavorite = Boolean(isFavorite);
    }
    if (body.lastVisitedAt !== undefined) {
      updateData.lastVisitedAt = body.lastVisitedAt ? new Date(body.lastVisitedAt) : new Date();
    }

    // 标签多对多关联更新 (若传入了 tags 数组)
    if (Array.isArray(tags)) {
      const tagsConnectOrCreate = tags
        .map((tagName: any) => (typeof tagName === 'string' ? tagName.trim() : tagName?.name?.trim()))
        .filter(Boolean)
        .map((cleanName: string) => ({
          where: { name_userId: { name: cleanName, userId: MOCK_USER_ID } },
          create: { name: cleanName, userId: MOCK_USER_ID }
        }));

      updateData.tags = {
        set: [], // 先清空原有关系
        connectOrCreate: tagsConnectOrCreate
      };
    }

    const updated = await prisma.bookmark.update({
      where: { id, userId: MOCK_USER_ID },
      data: updateData,
      include: { tags: true, collection: true }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Failed to update bookmark:', error);
    return NextResponse.json({ success: false, error: error.message || '更新书签失败' }, { status: 500 });
  }
}

// DELETE /api/bookmarks/[id]
// 默认软删除放入回收站 (status: 'TRASH')；若带 query ?permanent=true 则彻底物理删除
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const permanent = url.searchParams.get('permanent') === 'true';

    if (permanent) {
      await prisma.bookmark.delete({
        where: { id, userId: MOCK_USER_ID }
      });
      return NextResponse.json({ success: true, message: '书签已彻底删除' });
    } else {
      const trashed = await prisma.bookmark.update({
        where: { id, userId: MOCK_USER_ID },
        data: { status: 'TRASH' }
      });
      return NextResponse.json({ success: true, message: '已移入回收站', data: trashed });
    }
  } catch (error: any) {
    console.error('Failed to delete bookmark:', error);
    return NextResponse.json({ success: false, error: error.message || '删除书签失败' }, { status: 500 });
  }
}
