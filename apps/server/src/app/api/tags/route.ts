import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MOCK_USER_ID } from '@/lib/constants';

// GET /api/tags 获取当前用户所有标签及书签统计
export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      where: { userId: MOCK_USER_ID },
      include: {
        _count: {
          select: { bookmarks: true }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json({ success: true, data: tags });
  } catch (error: any) {
    console.error('Failed to fetch tags:', error);
    return NextResponse.json({ success: false, error: error.message || '获取标签失败' }, { status: 500 });
  }
}

// POST /api/tags 创建标签
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: '标签名称不能为空' }, { status: 400 });
    }

    const trimmedName = name.trim().replace(/^#/, '');

    const existing = await prisma.tag.findFirst({
      where: {
        userId: MOCK_USER_ID,
        name: trimmedName
      }
    });

    if (existing) {
      return NextResponse.json({ success: false, error: '已存在同名标签' }, { status: 400 });
    }

    const tag = await prisma.tag.create({
      data: {
        name: trimmedName,
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
      },
      include: {
        _count: { select: { bookmarks: true } }
      }
    });

    return NextResponse.json({ success: true, data: tag });
  } catch (error: any) {
    console.error('Failed to create tag:', error);
    return NextResponse.json({ success: false, error: error.message || '创建标签失败' }, { status: 500 });
  }
}

// DELETE /api/tags?unused=true 清理所有无书签关联的孤立标签
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const unusedOnly = searchParams.get('unused') === 'true';

    if (!unusedOnly) {
      return NextResponse.json({ success: false, error: '不支持无条件全量删除' }, { status: 400 });
    }

    // 查出所有关联书签数为 0 的标签
    const unusedTags = await prisma.tag.findMany({
      where: {
        userId: MOCK_USER_ID,
        bookmarks: { none: {} }
      },
      select: { id: true }
    });

    const ids = unusedTags.map(t => t.id);

    if (ids.length > 0) {
      await prisma.tag.deleteMany({
        where: { id: { in: ids } }
      });
    }

    return NextResponse.json({
      success: true,
      message: `已清理 ${ids.length} 个无用标签`,
      count: ids.length
    });
  } catch (error: any) {
    console.error('Failed to clean unused tags:', error);
    return NextResponse.json({ success: false, error: error.message || '清理无用标签失败' }, { status: 500 });
  }
}
