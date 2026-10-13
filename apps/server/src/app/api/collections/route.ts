import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MOCK_USER_ID } from '@/lib/constants';

export async function GET(request: Request) {
  try {
    // 获取用户所有的集合 (Folders)，包含 parentId 层次信息与书签统计
    const collections = await prisma.collection.findMany({
      where: { userId: MOCK_USER_ID },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { bookmarks: true, children: true }
        }
      }
    });
    
    return NextResponse.json({ success: true, data: collections });
  } catch (error) {
    console.error('Failed to fetch collections:', error);
    return NextResponse.json({ success: false, error: '获取集合失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, parentId } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: '名称不能为空' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const targetParentId = (parentId && typeof parentId === 'string') ? parentId : null;

    // 检查同一父级下是否已存在同名文件夹 (避免同级重名)
    const existing = await prisma.collection.findFirst({
      where: {
        userId: MOCK_USER_ID,
        parentId: targetParentId,
        name: trimmedName
      }
    });

    if (existing) {
      return NextResponse.json({ success: false, error: '同级目录下已存在同名文件夹' }, { status: 400 });
    }

    const createData: any = {
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
    };

    if (targetParentId) {
      createData.parent = { connect: { id: targetParentId } };
    }

    const collection = await prisma.collection.create({
      data: createData,
      include: {
        parent: true,
        _count: { select: { bookmarks: true, children: true } }
      }
    });

    return NextResponse.json({ success: true, data: collection });
  } catch (error) {
    console.error('Failed to create collection:', error);
    return NextResponse.json({ success: false, error: '创建集合失败' }, { status: 500 });
  }
}
