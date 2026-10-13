import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MOCK_USER_ID } from '@/lib/constants';

// DELETE /api/collections/[id] 删除文件夹
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.collection.delete({
      where: { id, userId: MOCK_USER_ID }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete collection:', error);
    return NextResponse.json({ success: false, error: error.message || '删除文件夹失败' }, { status: 500 });
  }
}

// PATCH /api/collections/[id] 重命名或移动文件夹
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, parentId } = body;

    const existing = await prisma.collection.findUnique({
      where: { id, userId: MOCK_USER_ID }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: '文件夹不存在' }, { status: 404 });
    }

    const updateData: any = {};

    // 1. 如果更新名称
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ success: false, error: '文件夹名称不能为空' }, { status: 400 });
      }
      const trimmedName = name.trim();
      const targetParentId = parentId !== undefined ? parentId : existing.parentId;

      // 检查同级重名（排除自身）
      const duplicate = await prisma.collection.findFirst({
        where: {
          userId: MOCK_USER_ID,
          parentId: targetParentId,
          name: trimmedName,
          NOT: { id }
        }
      });

      if (duplicate) {
        return NextResponse.json({ success: false, error: '同级目录下已存在同名文件夹' }, { status: 400 });
      }

      updateData.name = trimmedName;
    }

    // 2. 如果更新 parentId
    if (parentId !== undefined) {
      if (parentId === id) {
        return NextResponse.json({ success: false, error: '不能将自身设置为父文件夹' }, { status: 400 });
      }
      if (parentId === null) {
        updateData.parent = { disconnect: true };
      } else {
        updateData.parent = { connect: { id: parentId } };
      }
    }

    const updated = await prisma.collection.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { bookmarks: true, children: true } }
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Failed to update collection:', error);
    return NextResponse.json({ success: false, error: error.message || '更新文件夹失败' }, { status: 500 });
  }
}

