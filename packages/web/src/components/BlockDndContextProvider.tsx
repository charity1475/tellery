import { ContentBlocks } from '@app/components/editor/ContentBlock'
import { getDuplicatedBlocksFragment } from '@app/context/editorTranscations'
import { useCreateEmptyBlock } from '@app/helpers/blockFactory'
import { useBlockTranscations } from '@app/hooks/useBlockTranscation'
import { usePushFocusedBlockIdState } from '@app/hooks/usePushFocusedBlockIdState'
import { getBlockFromSnapshot, useBlockSnapshot } from '@app/store/block'
import { Direction, Editor } from '@app/types'
import { DndItemDataType, DnDItemTypes } from '@app/utils/dnd'
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  getBoundingClientRect,
  MeasuringConfiguration,
  MeasuringFrequency,
  MeasuringStrategy,
  MouseSensor,
  useDraggable,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { css, cx } from '@emotion/css'
import { Global } from '@emotion/react'
import React, { memo, ReactNode, useCallback, useRef, useState } from 'react'
import ReactTestUtils from 'react-dom/test-utils'
import invariant from 'tiny-invariant'
import {
  closetBorder,
  findDroppbleBlockIdAndDirection,
  getFakeDragbleElement,
  logger,
  MouseSensorOptions
} from '../context/blockDnd'
import { useSetDroppingArea } from '../hooks/useDroppingArea'
import { DndSensor } from '../lib/dnd-kit/dndSensor'
import { useSetUploadResource } from './editor/hooks/useUploadResource'
import { notifyBlockManuallyCreated } from './editor/oberveables'
import { getSubsetOfBlocksSnapshot } from './editor/utils'
import { DataAssetItem } from './SideBarDataAssets'

const DEFAULT_LAYOUT_MEASURING: MeasuringConfiguration = {
  droppable: {
    measure: getBoundingClientRect,
    strategy: MeasuringStrategy.BeforeDragging,
    frequency: MeasuringFrequency.Optimized
  }
}

const _TelleryDNDContext: React.FC<{
  dataTransferRef: React.MutableRefObject<DataTransfer | null>
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>
  setPreviewData: React.Dispatch<React.SetStateAction<React.ReactNode>>
  children: ReactNode
}> = ({ children, dataTransferRef, setIsDragging, setPreviewData }) => {
  const droppingAreaRef = useRef<{ blockId: string; direction: Direction } | null>(null)
  const setDroppingArea = useSetDroppingArea()
  const mouseSensor = useSensor(MouseSensor, MouseSensorOptions)
  const dragSensor = useSensor(DndSensor)
  const sensors = useSensors(dragSensor, mouseSensor)
  const blockTranscations = useBlockTranscations()
  const createEmptyBlock = useCreateEmptyBlock()
  const setUploadResource = useSetUploadResource()
  const snapshot = useBlockSnapshot()
  const focusBlockHandler = usePushFocusedBlockIdState()

  const handleDragCancel = useCallback(() => {
    logger('drag cancel')
    setIsDragging(false)
    setDroppingArea(null)
    droppingAreaRef.current = null
    setPreviewData(null)
  }, [setDroppingArea, setIsDragging, setPreviewData])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      logger('drag end', event)
      setIsDragging(false)
      setPreviewData(null)
      const item = event.active.data.current as DndItemDataType
      logger('drag end', item, droppingAreaRef.current)
      if (droppingAreaRef.current) {
        if (item.type === DnDItemTypes.Block || item.type === DnDItemTypes.BlocksFragment) {
          const id = droppingAreaRef.current.blockId
          const over = event.over
          if (!over) return
          const overData = over.data.current
          const overStoryId = overData?.storyId
          const fragment =
            item.type === DnDItemTypes.Block
              ? {
                  children: [item.blockData.id],
                  data: { [item.blockData.id]: item.blockData }
                }
              : getDuplicatedBlocksFragment(item.children, item.data, overStoryId, overStoryId)

          invariant(overData?.storyId, 'overing story id is null')
          blockTranscations.insertBlocks(overStoryId, {
            blocksFragment: fragment,
            targetBlockId: id,
            direction: droppingAreaRef.current.direction
          })

          const block = fragment.data[fragment.children[0]]
          focusBlockHandler(block.id, block.storyId, false)
          notifyBlockManuallyCreated(block.id)
        } else if (item.type === DnDItemTypes.BlockIds) {
          const id = droppingAreaRef.current.blockId
          const blockIds = item.ids
          invariant(blockIds, 'blocks i snull')
          const over = event.over
          if (!over) return
          const overData = over.data.current
          const overStoryId = overData?.storyId
          const targetBlock = getBlockFromSnapshot(id, snapshot)
          invariant(overData?.storyId, 'overing story id is null')
          if (item.storyId !== overStoryId) {
            const duplicatedBlocksFragment = getDuplicatedBlocksFragment(
              blockIds,
              getSubsetOfBlocksSnapshot(snapshot, blockIds),
              overStoryId,
              targetBlock.parentId,
              {}
            )

            blockTranscations.insertBlocks(overStoryId, {
              blocksFragment: duplicatedBlocksFragment,
              targetBlockId: id,
              direction: droppingAreaRef.current.direction
            })
          } else {
            blockTranscations.moveBlocks(overStoryId, {
              blocksFragment: { children: blockIds, data: getSubsetOfBlocksSnapshot(snapshot, blockIds) },
              targetBlockId: id,
              direction: droppingAreaRef.current.direction
            })
          }
        } else if (item.type === DnDItemTypes.File) {
          const over = event.over
          if (!over) return
          const overData = over.data.current
          const overStoryId = overData?.storyId
          logger('drga end', event, dataTransferRef.current)
          const files = dataTransferRef.current?.files
          invariant(files, 'files is empty')
          const fileBlocks = Array.from(files).map(() =>
            createEmptyBlock({
              type: Editor.BlockType.File,
              storyId: overStoryId,
              parentId: overStoryId
            })
          )
          blockTranscations.insertBlocks(overStoryId, {
            blocksFragment: {
              children: fileBlocks.map((block) => block.id),
              data: fileBlocks.reduce((a, c) => {
                a[c.id] = c
                return a
              }, {} as Record<string, Editor.BaseBlock>)
            },
            targetBlockId: droppingAreaRef.current.blockId,
            direction: droppingAreaRef.current.direction
          })
          fileBlocks.forEach((block, i) => {
            const file = files[i]
            setUploadResource({ blockId: block.id, file })
          })
          dataTransferRef.current = null
        } else {
          invariant(false, 'not supported dnd item type')
        }
      }

      setDroppingArea(null)
      droppingAreaRef.current = null
    },
    [
      setIsDragging,
      setPreviewData,
      setDroppingArea,
      blockTranscations,
      focusBlockHandler,
      snapshot,
      dataTransferRef,
      createEmptyBlock,
      setUploadResource
    ]
  )

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const over = event.over
      if (!over) return
      const overData = over.data.current
      const leaveBlockId = overData?.id
      if (!leaveBlockId) return
      if (!event.active.rect.current?.translated) return

      const { top, left } = event.active.rect.current.translated
      const dropAreaInfo = findDroppbleBlockIdAndDirection(
        leaveBlockId,
        {
          x: left,
          y: top
        },
        snapshot
      )
      const item = event.active.data.current as DndItemDataType
      if (item.type === DnDItemTypes.BlockIds) {
        const blockIds = item.ids
        // TODO: dnd-kit bug, drag move may trigger before drag start
        // if (!blockIds) return
        // TODO: Restore it
        if (dropAreaInfo && blockIds?.includes(dropAreaInfo[0])) {
          setDroppingArea(null)
        }
      }

      if (dropAreaInfo) {
        setDroppingArea((value) => {
          const [id, direction] = dropAreaInfo as [string, Direction]
          if (value === null || value?.blockId !== id || value?.direction !== direction) {
            const newValue = {
              blockId: id,
              direction: direction
            }
            droppingAreaRef.current = newValue
            return newValue
          }
          droppingAreaRef.current = value
          return value
        })
      } else {
        setDroppingArea(null)
      }
    },
    [setDroppingArea, snapshot]
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setIsDragging(true)
      const data = event.active.data.current as DndItemDataType
      logger('drag start', event)
      if (!data) return
      if (data.type === DnDItemTypes.Block) {
        setPreviewData(<ContentBlocks blockIds={[data.originalBlockId]} readonly parentType={Editor.BlockType.Story} />)
      } else if (data.type === DnDItemTypes.BlockIds) {
        setPreviewData(<ContentBlocks blockIds={data.ids} readonly parentType={Editor.BlockType.Story} />)
      } else if (data.type === DnDItemTypes.BlocksFragment) {
        setPreviewData(<DataAssetItem blockId={data.originalBlockId} isExpanded={false} />)
      } else {
        setPreviewData(
          <div
            className={css`
              width: 10px;
              height: 10px;
            `}
          ></div>
        )
      }
    },
    [setIsDragging, setPreviewData]
  )
  return (
    <DndContext
      collisionDetection={closetBorder}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      sensors={sensors}
      onDragStart={handleDragStart}
      measuring={DEFAULT_LAYOUT_MEASURING}
    >
      {children}
    </DndContext>
  )
}

const TelleryDNDContext = memo(_TelleryDNDContext)

export const BlockDndContextProvider: React.FC = ({ children }) => {
  const [previewData, setPreviewData] = useState<ReactNode | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dataTransferRef = useRef<DataTransfer | null>(null)

  return (
    <div
      onDrop={useCallback((e) => {
        dataTransferRef.current = e.dataTransfer
        e.preventDefault()
      }, [])}
      onDragOver={useCallback(
        (e) => {
          if (isDragging === false) {
            logger('on darg entter', e, e.nativeEvent)
            const handle = getFakeDragbleElement()
            const nativeEvent = e.nativeEvent
            e.persist()
            handle.style.left = `${nativeEvent.clientX}px`
            handle.style.top = `${nativeEvent.clientY}px`

            ReactTestUtils.Simulate.dragEnter(handle, {
              nativeEvent: e.nativeEvent,
              clientX: nativeEvent.clientX,
              clientY: nativeEvent.clientY,
              button: nativeEvent.button
            })
          }
        },
        [isDragging]
      )}
    >
      <TelleryDNDContext
        dataTransferRef={dataTransferRef}
        setIsDragging={setIsDragging}
        setPreviewData={setPreviewData}
      >
        <FileDraggble />
        {children}
        <DragOverlay
          dropAnimation={null}
          className={cx(css`
            opacity: 0.5;
          `)}
        >
          {isDragging && (
            <>
              <React.Suspense fallback={<div>loading...</div>}>{previewData}</React.Suspense>
              <Global
                styles={{
                  '*': {
                    cursor: 'grabbing'
                  }
                }}
              />
            </>
          )}
        </DragOverlay>
      </TelleryDNDContext>
    </div>
  )
}

const FileDraggble: React.FC = () => {
  const ref = useRef<HTMLDivElement | null>(null)
  const blockDrag = useDraggable({
    id: `drag-native`,
    data: {
      type: DnDItemTypes.File,
      id: 'native',
      storyId: '0'
    }
  })

  return (
    <div
      ref={(_ref) => {
        ref.current = _ref
        blockDrag.setNodeRef(_ref)
      }}
      id="fake-drag-handler"
      {...blockDrag.listeners}
      {...blockDrag.attributes}
      className={css`
        width: 10px;
        height: 10px;
        position: fixed;
        left: 0;
        top: 0;
        pointer-events: none;
      `}
    ></div>
  )
}
