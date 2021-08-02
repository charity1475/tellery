import { IconCommonMetrics, IconCommonQuestion } from '@app/assets/icons'
import { createEmptyBlock } from '@app/helpers/blockFactory'
import { useBlockSuspense, useSearchMetrics } from '@app/hooks/api'
import { usePushFocusedBlockIdState } from '@app/hooks/usePushFocusedBlockIdState'
import { useStoryBlocksMap } from '@app/hooks/useStoryBlock'
import { ThemingVariables } from '@app/styles'
import { Editor } from '@app/types'
import { DndItemDataBlockType, DnDItemTypes } from '@app/utils/dnd'
import { useDraggable } from '@dnd-kit/core'
import { css, cx } from '@emotion/css'
import { Tab } from '@headlessui/react'
import React, { Fragment, useMemo } from 'react'
import PerfectScrollbar from 'react-perfect-scrollbar'
import { useStoryPathParams } from '../hooks/useStoryPathParams'
import { useGetBlockTitleTextSnapshot } from './editor'
import { isQuestionLikeBlock } from './editor/Blocks/utils'
import { getFilteredOrderdSubsetOfBlocks } from './editor/utils'
import { useQuestionEditor } from './StoryQuestionsEditor'

const TocQuestionItem: React.FC<{ blockId: string; storyId: string }> = ({ blockId, storyId }) => {
  const block = useBlockSuspense(blockId)
  const getBlockTitle = useGetBlockTitleTextSnapshot()
  const pushFocusedBlockIdState = usePushFocusedBlockIdState()

  return (
    <div
      className={css`
        display: flex;
        align-items: center;
        cursor: pointer;
        padding: 10px 16px;
        margin-bottom: 5px;
        :hover {
          background: ${ThemingVariables.colors.primary[5]};
        }
      `}
      onClick={() => {
        pushFocusedBlockIdState(block.id, block.storyId)
      }}
    >
      {block.type === Editor.BlockType.Question ? (
        <IconCommonQuestion
          color={ThemingVariables.colors.gray[0]}
          className={css`
            flex-shrink: 0;
            margin-right: 8px;
          `}
        />
      ) : null}
      {block.type === Editor.BlockType.Metric ? (
        <IconCommonMetrics
          color={ThemingVariables.colors.gray[0]}
          className={css`
            flex-shrink: 0;
            margin-right: 8px;
          `}
        />
      ) : null}
      <span
        className={css`
          font-size: 12px;
          line-height: 14px;
          color: ${ThemingVariables.colors.text[0]};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        `}
      >
        {getBlockTitle(block)}
      </span>
    </div>
  )
}

const DataAssetItem: React.FC<{ blockId: string; currentStoryId: string }> = ({ blockId, currentStoryId }) => {
  const block = useBlockSuspense<Editor.QuestionBlock>(blockId)
  const getBlockTitle = useGetBlockTitleTextSnapshot()

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `drag-${blockId}`,
    data: {
      type: DnDItemTypes.Block,
      blockData: createEmptyBlock<Editor.QuestionBlock>({
        type: Editor.BlockType.Question,
        storyId: currentStoryId,
        parentId: currentStoryId,
        content: {
          title: block.content?.title,
          sql: `select * from {{${blockId}}}`,
          visualization: block.content?.visualization,
          snapshotId: block.content?.snapshotId
        }
      })
    } as DndItemDataBlockType
  })

  const questionEditor = useQuestionEditor()

  return (
    <div
      className={css`
        display: flex;
        align-items: center;
        cursor: pointer;
        padding: 10px 16px;
        margin-bottom: 5px;
        user-select: none;
        :hover {
          background: ${ThemingVariables.colors.primary[5]};
        }
      `}
      {...listeners}
      {...attributes}
      ref={setNodeRef}
      onClick={() => {
        // pushFocusedBlockIdState(block.id, block.storyId)
        questionEditor.open({ mode: 'SQL', blockId: block.id, readonly: false, storyId: block.storyId! })
      }}
    >
      {block.type === Editor.BlockType.Question ? (
        <IconCommonQuestion
          color={ThemingVariables.colors.gray[0]}
          className={css`
            flex-shrink: 0;
            margin-right: 8px;
          `}
        />
      ) : null}
      {block.type === Editor.BlockType.Metric ? (
        <IconCommonMetrics
          color={ThemingVariables.colors.gray[0]}
          className={css`
            flex-shrink: 0;
            margin-right: 8px;
          `}
        />
      ) : null}
      <span
        className={css`
          font-size: 12px;
          line-height: 14px;
          color: ${ThemingVariables.colors.text[0]};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        `}
      >
        {getBlockTitle(block)}
      </span>
    </div>
  )
}

const CurrentStoryQuestions: React.FC = () => {
  const storyId = useStoryPathParams()

  return storyId ? <StoryQuestions storyId={storyId} /> : null
}

const StoryQuestions: React.FC<{ storyId: string }> = ({ storyId }) => {
  const storyBlocksMap = useStoryBlocksMap(storyId)
  const questionLikeBlocks = useMemo(() => {
    if (!storyBlocksMap) return []
    return getFilteredOrderdSubsetOfBlocks(storyBlocksMap, storyId, (block) => isQuestionLikeBlock(block.type))
  }, [storyBlocksMap, storyId])

  if (!storyId) return null

  return (
    <PerfectScrollbar
      className={css`
        flex: 1;
        overflow-y: auto;
      `}
      options={{ suppressScrollX: true }}
    >
      <div>
        {questionLikeBlocks.map((block) => {
          return <TocQuestionItem key={block.id} blockId={block.id} storyId={storyId} />
        })}
      </div>
    </PerfectScrollbar>
  )
}

const AllMetrics: React.FC = () => {
  const metricBlocksQUery = useSearchMetrics('', 1000)
  const storyId = useStoryPathParams()
  const metricBlocks = useMemo(() => {
    return Object.values(metricBlocksQUery.data?.blocks ?? {}).filter((block) => block.type === Editor.BlockType.Metric)
  }, [metricBlocksQUery.data?.blocks])

  return (
    <PerfectScrollbar
      className={css`
        flex: 1;
        overflow-y: auto;
      `}
      options={{ suppressScrollX: true }}
    >
      <div>
        {metricBlocks.map((block) => {
          return <DataAssetItem key={block.id} blockId={block.id} currentStoryId={storyId!} />
        })}
      </div>
    </PerfectScrollbar>
  )
}

const TABS = [
  { name: 'Current Page', Component: <CurrentStoryQuestions /> },
  {
    name: 'All Metrics',
    Component: <AllMetrics />
  }
]

export const SideBarMetricsSection = () => {
  return (
    <div
      className={css`
        height: 100%;
        overflow-y: hidden;
        border-right: 1px solid #dedede;
        display: flex;
        flex-direction: column;
      `}
    >
      <Tab.Group>
        <Tab.List
          className={css`
            border-bottom: solid 1px ${ThemingVariables.colors.gray[1]};
          `}
        >
          {TABS.map((tab) => (
            <Tab as={Fragment} key={tab.name}>
              {({ selected }) => (
                <button
                  className={cx(
                    css`
                      font-style: normal;
                      font-weight: 500;
                      font-size: 12px;
                      line-height: 15px;
                      color: ${ThemingVariables.colors.text[1]};
                      background: transparent;
                      border: none;
                      padding: 15px;
                      cursor: pointer;
                    `,
                    selected &&
                      css`
                        color: ${ThemingVariables.colors.text[0]};
                      `
                  )}
                >
                  {tab.name}
                </button>
              )}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels
          className={css`
            flex: 1;
            overflow-y: hidden;
          `}
        >
          {TABS.map((tab) => (
            <Tab.Panel
              className={css`
                height: 100%;
              `}
              key={tab.name}
            >
              {tab.Component}
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  )
}
