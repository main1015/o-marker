import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MOCK_USER_ID } from '@/lib/constants';

// PATCH /api/tags/[id] 重命名标签
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: '标签名称不能为空' }, { status: 400 });
    }

    const trimmedName = name.trim().replace(/^#/, '');

    const existing = await prisma.tag.findUnique({
      where: { id, userId: MOCK_USER_ID }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: '标签不存在' }, { status: 404 });
    }

    // 检查是否存在同名标签 (排除自身)
    const duplicate = await prisma.tag.findFirst({
      where: {
        userId: MOCK_USER_ID,
        name: trimmedName,
        NOT: { id }
      }
    });

    if (duplicate) {
      return NextResponse.json({ success: false, error: '已存在同名标签' }, { status: 400 });
    }

    const updated = await prisma.tag.update({
      where: { id },
      data: { name: trimmedName },
      include: {
        _count: { select: { bookmarks: true } }
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Failed to update tag:', error);
    return NextResponse.json({ success: false, error: error.message || '更新标签失败' }, { status: 500 });
  }
}

// DELETE /api/tags/[id] 删除单个标签
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.tag.delete({
      where: { id, userId: MOCK_USER_ID }
    });

    return NextResponse.json({ success: true, message: '标签已删除' });
  } catch (error: any) {
    console.error('Failed to delete tag:', error);
    return NextResponse.json({ success: false, error: error.message || '删除标签失败' }, { status: 500 });
  }
}
