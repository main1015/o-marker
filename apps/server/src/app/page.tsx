import prisma from '@/lib/prisma'
import { Folder, Compass, Link2, Hash, Trash2 } from 'lucide-react'
import BookmarkGrid from '@/components/BookmarkGrid'
import SidebarCollections from '@/components/SidebarCollections'
import SidebarNav from '@/components/SidebarNav'
import SidebarTags from '@/components/SidebarTags'
import MainHeaderInfo from '@/components/MainHeaderInfo'
import EmptyState from '@/components/EmptyState'
import SettingsModal from '@/components/SettingsModal'
import CategoryManageModal from '@/components/CategoryManageModal'
import ViewModeSwitch from '@/components/ViewModeSwitch'
import SearchBar from '@/components/SearchBar'
import LanguageSelector from '@/components/LanguageSelector'
import AppLayout from '@/components/AppLayout'
import { DEFAULT_PAGE_SIZE, MOCK_USER_ID } from '@/lib/constants'

export const instant = false;

export default async function Dashboard({ 
  searchParams 
}: { 
  searchParams: Promise<{ [key: string]: string | undefined }> 
}) {
  const resolvedSearchParams = await searchParams;

  const activeCollection = resolvedSearchParams.collectionId
  const activeTag = resolvedSearchParams.tag
  const activeFilter = resolvedSearchParams.filter || "all" // all, unclassified, trash

  const searchQuery = resolvedSearchParams.q?.trim()

  // 构建 Prisma 查询条件
  let whereClause: any = { userId: MOCK_USER_ID, status: 'ACTIVE' }
  
  if (activeFilter === 'unclassified') {
    whereClause.collectionId = null
  } else if (activeFilter === 'favorites') {
    whereClause.isFavorite = true
  } else if (activeFilter === 'trash') {
    whereClause.status = 'TRASH'
  }

  if (activeCollection) {
    whereClause.collectionId = activeCollection
  }
  if (activeTag) {
    whereClause.tags = { some: { name: activeTag } }
  }

  // 搜索关键字模糊匹配 (标题、网址、简介、标签)
  if (searchQuery) {
    whereClause.OR = [
      { title: { contains: searchQuery } },
      { url: { contains: searchQuery } },
      { description: { contains: searchQuery } },
      { tags: { some: { name: { contains: searchQuery } } } }
    ]
  }

  // 并行获取数据与统计计数 (首屏预取条数由常量中心 DEFAULT_PAGE_SIZE 统一管控)
  const [bookmarks, currentViewTotal, collections, tags, totalActiveCount, favoritesCount, unclassifiedCount, trashCount] = await Promise.all([
    prisma.bookmark.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: DEFAULT_PAGE_SIZE,
      include: { tags: true, collection: true }
    }).catch((err) => {
      console.error('findMany bookmarks error:', err);
      return [];
    }),
    prisma.bookmark.count({
      where: whereClause
    }).catch(() => 0),
    prisma.collection.findMany({
      where: { userId: MOCK_USER_ID },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { bookmarks: true } } }
    }).catch((err) => {
      console.error('findMany collections error:', err);
      return [];
    }),
    prisma.tag.findMany({
      where: { userId: MOCK_USER_ID },
      include: { _count: { select: { bookmarks: true } } }
    }).catch((err) => {
      console.error('findMany tags error:', err);
      return [];
    }),
    prisma.bookmark.count({
      where: { userId: MOCK_USER_ID, status: 'ACTIVE' }
    }).catch(() => 0),
    prisma.bookmark.count({
      where: { userId: MOCK_USER_ID, status: 'ACTIVE', isFavorite: true }
    }).catch(() => 0),
    prisma.bookmark.count({
      where: { userId: MOCK_USER_ID, status: 'ACTIVE', collectionId: null }
    }).catch(() => 0),
    prisma.bookmark.count({
      where: { userId: MOCK_USER_ID, status: 'TRASH' }
    }).catch(() => 0)
  ])


  return (
    <AppLayout
      sidebarContent={
        <>
          {/* 基础分类 */}
          <SidebarNav
            activeFilter={activeFilter}
            activeCollection={activeCollection}
            activeTag={activeTag}
            totalActiveCount={totalActiveCount}
            favoritesCount={favoritesCount}
            unclassifiedCount={unclassifiedCount}
            trashCount={trashCount}
          />

          {/* 集合 / 文件夹 (支持新建与删除) */}
          <SidebarCollections 
            collections={collections} 
            activeCollectionId={activeCollection} 
          />

          {/* 标签 */}
          <SidebarTags tags={tags} activeTag={activeTag} />
        </>
      }
      sidebarFooter={
        <>
          <CategoryManageModal />
          <SettingsModal 
            stats={{
              totalBookmarks: totalActiveCount,
              totalCollections: collections.length,
              totalTags: tags.length
            }} 
          />
        </>
      }
      headerSearch={<SearchBar />}
      headerActions={
        <div className="flex items-center gap-3">
          <LanguageSelector />
          <ViewModeSwitch />
        </div>
      }
    >
      {/* 瀑布流书签卡片区 */}
      <div className="flex-1 overflow-y-auto p-8">
        <MainHeaderInfo
          searchQuery={searchQuery}
          activeFilter={activeFilter}
          activeCollection={activeCollection}
          activeCollectionName={collections.find(c => c.id === activeCollection)?.name}
          activeTag={activeTag}
          totalCount={currentViewTotal}
        />

        {bookmarks.length === 0 ? (
          <EmptyState searchQuery={searchQuery} />
        ) : (
          <BookmarkGrid 
            initialBookmarks={bookmarks} 
            collections={collections}
            isTrashView={activeFilter === 'trash'} 
            totalCount={currentViewTotal}
            pageSize={DEFAULT_PAGE_SIZE}
            activeFilter={activeFilter}
            activeCollectionId={activeCollection}
            activeTag={activeTag}
            searchQuery={searchQuery}
          />
        )}
      </div>
    </AppLayout>
  )
}

