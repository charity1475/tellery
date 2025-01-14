import {
  IconCommonArrowLeft,
  IconCommonArrowUnfold,
  IconCommonLink,
  IconMenuHide,
  IconMenuShow
} from '@app/assets/icons'
import IconButton from '@app/components/kit/IconButton'
import { useDataFieldsDisplayType } from '@app/hooks/useDataFieldsDisplayType'
import { ThemingVariables } from '@app/styles'
import { css, cx } from '@emotion/css'
import Tippy from '@tippyjs/react'
import { sortBy } from 'lodash'
import React, { useEffect, useMemo } from 'react'
import { useAsyncDebounce, useGlobalFilter, usePagination, useSortBy, useTable } from 'react-table'
import { ConfigSection } from '../components/ConfigSection'
import { ConfigSelect } from '../components/ConfigSelect'
import { ConfigTab } from '../components/ConfigTab'
import { SortableList } from '../components/SortableList'
import { DisplayType, Type } from '../types'
import { formatRecord, isNumeric, isTimeSeries } from '../utils'
import type { Chart } from './base'

const TABLE_ROW_HEIGHT_MIN = 30

const VERTICAL_BORDER_WITDH = 0

function GlobalFilter({ globalFilter, setGlobalFilter }: any) {
  const [value, setValue] = React.useState(globalFilter)
  const onChange = useAsyncDebounce((value) => {
    setGlobalFilter(value || undefined)
  }, 200)

  return (
    <input
      value={value || ''}
      onChange={(e) => {
        setValue(e.target.value)
        onChange(e.target.value)
      }}
      onCut={(e) => {
        e.stopPropagation()
      }}
      className={css`
        font-size: 12px;
        color: ${ThemingVariables.colors.text[0]};
        width: 0;
        flex: 1;
        height: 24px;
        outline: none;
        border: none;
        background-color: ${ThemingVariables.colors.primary[5]};
        box-sizing: border-box;
        border-radius: 4px;
        margin-left: 4px;
        padding: 0 6px;
      `}
      placeholder={`search...`}
    />
  )
}

const getPageSizeByHeight = (height: number) => Math.max(Math.floor((height - 1) / (TABLE_ROW_HEIGHT_MIN + 1)) - 2, 1)

enum DISPLAY_AS_TYPE {
  Auto = 'auto',
  Text = 'text',
  Link = 'link',
  Image = 'image'
}
const DISPLAY_AS_TYPES = [DISPLAY_AS_TYPE.Auto, DISPLAY_AS_TYPE.Text, DISPLAY_AS_TYPE.Link, DISPLAY_AS_TYPE.Image]

const isImage = (text: string) => /^https?:\/\/.+\.(jpg|jpeg|png|gif|bmp|svg)$/i.test(text)
const isLink = (text: string) => /^https?:\/\//.test(text)
const extractHostFromLink = (link: string) => {
  try {
    const url = new URL(link)
    return url.hostname
  } catch {
    return link
  }
}

const getDisplayTypeData = (text: string, type: DISPLAY_AS_TYPE) => {
  let asType = type
  let data: string[] = [text]
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'string') {
      data = parsed
    }
  } catch (e) {}

  if (asType === DISPLAY_AS_TYPE.Auto) {
    if (isImage(data[0])) {
      asType = DISPLAY_AS_TYPE.Image
    } else if (isLink(data[0])) {
      asType = DISPLAY_AS_TYPE.Link
    } else {
      asType = DISPLAY_AS_TYPE.Text
    }
  }

  return [data, asType] as [string[], DISPLAY_AS_TYPE]
}

const CellRenderer: React.FC<{ cell: any; displayType: DisplayType; displayAs?: DISPLAY_AS_TYPE }> = ({
  cell,
  displayType,
  displayAs = DISPLAY_AS_TYPE.Auto
}) => {
  if (displayType !== 'STRING') {
    return <>{formatRecord(cell.value, displayType)}</>
  }
  const [data, asType] = getDisplayTypeData(cell.value, displayAs)
  if (asType === DISPLAY_AS_TYPE.Text) {
    return <>{formatRecord(cell.value, displayType)}</>
  } else if (asType === DISPLAY_AS_TYPE.Image) {
    return (
      <>
        {data.map((item, i) => {
          return (
            <img
              title={item}
              key={i}
              src={item}
              className={css`
                width: 24px;
                height: 24px;
                object-fit: cover;
              `}
            ></img>
          )
        })}
      </>
    )
  } else if (asType === DISPLAY_AS_TYPE.Link) {
    return (
      <>
        {data.map((item, i) => {
          return (
            <a
              key={i}
              href={item}
              target="_blank"
              className={css`
                color: ${ThemingVariables.colors.primary[1]};
                word-wrap: break-word;
                text-decoration: inherit;
                user-select: text;
                border-bottom: solid 1px currentColor;
              `}
              rel="noreferrer"
            >
              {extractHostFromLink(item)}
              {/* <IconCommonLink
                className={css`
                  height: 12px;
                `}
              /> */}
            </a>
          )
        })}
      </>
    )
  }
  return <>{formatRecord(cell.value, displayType)}</>
}

export const table: Chart<Type.TABLE> = {
  type: Type.TABLE,

  initializeConfig(data, { cache }) {
    if (cache[Type.TABLE]) {
      return cache[Type.TABLE]!
    }
    return {
      type: Type.TABLE,
      columnOrder: data.fields.map(({ name }) => name),
      columnVisibility: {}
    }
  },

  Configuration(props) {
    // TODO: remove this
    const columnOrder = useMemo(
      () =>
        sortBy(props.config.columnOrder).join() === sortBy(props.data.fields.map(({ name }) => name)).join()
          ? props.config.columnOrder
          : props.data.fields.map(({ name }) => name),
      [props.config.columnOrder, props.data.fields]
    )

    return (
      <ConfigTab tabs={['Data']}>
        <ConfigSection title="Columns">
          <SortableList
            value={columnOrder}
            onChange={(value) => {
              props.onConfigChange('columnOrder', value)
            }}
            renderItem={(item) => {
              const filed = props.data.fields.find((f) => f.name === item)
              return (
                <div
                  className={css`
                    width: 100%;
                    font-size: 12px;
                    padding: 0 6px;
                    height: 32px;
                    color: ${ThemingVariables.colors.text[0]};
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-radius: 4px;
                    :hover {
                      background-color: ${ThemingVariables.colors.primary[5]};
                    }
                  `}
                >
                  <div
                    className={css`
                      flex-grow: 1;
                      flex-shrink: 0;
                      margin-right: 10px;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    `}
                  >
                    {item}
                  </div>
                  {filed?.displayType === 'STRING' && (
                    <div
                      className={css`
                        flex-shrink: 0;
                        width: 100px;
                        margin-right: 10px;
                      `}
                    >
                      <ConfigSelect
                        title="string display as"
                        options={DISPLAY_AS_TYPES}
                        value={props.config.displayAs?.[item] ?? DISPLAY_AS_TYPE.Auto}
                        className={css`
                          height: 28px;
                        `}
                        onChange={(value) => {
                          props.onConfigChange('displayAs', {
                            ...props.config.displayAs,
                            [item]: value
                          })
                        }}
                      />
                    </div>
                  )}
                  {props.config.columnVisibility[item] === false ? (
                    <IconButton
                      icon={IconMenuHide}
                      color={ThemingVariables.colors.text[1]}
                      className={css`
                        flex-shrink: 0;
                      `}
                      onClick={() => {
                        props.onConfigChange('columnVisibility', {
                          ...props.config.columnVisibility,
                          [item]: true
                        })
                      }}
                    />
                  ) : (
                    <IconButton
                      icon={IconMenuShow}
                      color={ThemingVariables.colors.text[1]}
                      className={css`
                        flex-shrink: 0;
                      `}
                      onClick={() => {
                        props.onConfigChange('columnVisibility', {
                          ...props.config.columnVisibility,
                          [item]: false
                        })
                      }}
                    />
                  )}
                </div>
              )
            }}
          />
        </ConfigSection>
      </ConfigTab>
    )
  },

  Diagram(props) {
    // TODO: remove this
    const columnOrder = useMemo(
      () =>
        sortBy(props.config.columnOrder).join() === sortBy(props.data.fields.map(({ name }) => name)).join()
          ? props.config.columnOrder
          : props.data.fields.map(({ name }) => name),
      [props.config.columnOrder, props.data.fields]
    )

    const order = useMemo<{ [key: string]: number }>(() => {
      const map = props.data.fields.reduce((obj, { name }, index) => {
        obj[name] = index
        return obj
      }, {} as { [name: string]: number })
      return columnOrder.reduce((obj, name, index) => {
        const item = props.data.fields[index]
        if (item) {
          obj[item.name] = map[name]
        }
        return obj
      }, {} as { [name: string]: number })
    }, [columnOrder, props.data])

    const columns = useMemo(
      () =>
        props.data.fields
          .filter(({ name }) => props.config.columnVisibility[name] !== false)
          .filter(({ name }) => props.data.fields[order[name]])
          .map(({ name }, index) => ({
            ...props.data.fields[order[name]],
            order: order[name],
            Header: name,
            accessor: (record: any) => record[order[name]]
          })),
      [order, props.config.columnVisibility, props.data]
    )
    const displayTypes = useDataFieldsDisplayType(props.data.fields)

    const {
      getTableProps,
      getTableBodyProps,
      headerGroups,
      prepareRow,
      page,
      canPreviousPage,
      canNextPage,
      nextPage,
      previousPage,
      setPageSize,
      state: { pageIndex, pageSize, globalFilter },
      preGlobalFilteredRows,
      setGlobalFilter
    } = useTable(
      {
        columns: columns,
        data: props.data.records,
        initialState: {
          pageSize: getPageSizeByHeight(props.dimensions.height)
        }
      } as any,
      useGlobalFilter,
      useSortBy,
      usePagination
    ) as any

    useEffect(() => {
      setPageSize(getPageSizeByHeight(props.dimensions.height))
    }, [props.dimensions.height, setPageSize])

    const tableRowHeight = (props.dimensions.height - VERTICAL_BORDER_WITDH) / (pageSize + 2) - VERTICAL_BORDER_WITDH

    return (
      <>
        <div
          className={css`
            height: 100%;
            width: 100%;
            position: relative;
            display: flex;
            flex-direction: column;
            background: ${ThemingVariables.colors.gray[5]};
            font-size: 14px;
            color: ${ThemingVariables.colors.text[0]};
          `}
        >
          <div
            className={css`
              flex: 1;
              width: 100%;
              overflow-x: auto;
              /* TODO: append scrollbar size to prevent this */
              overflow-y: hidden;
            `}
          >
            <table
              {...getTableProps()}
              className={css`
                min-width: 100%;
                max-height: 100%;
                border-collapse: collapse;
                border: none;
                tr:nth-child(even) {
                  background: ${ThemingVariables.colors.primary[5]};
                }
                td {
                  border-left: 1px solid ${ThemingVariables.colors.gray[1]};
                }
                tr td:first-child {
                  border-left: none;
                }
              `}
            >
              <thead>
                {headerGroups.map((headerGroup: any) => (
                  // eslint-disable-next-line react/jsx-key
                  <tr {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map((column: any) => (
                      <th
                        {...column.getHeaderProps(column.getSortByToggleProps())}
                        className={css`
                          height: ${tableRowHeight}px;
                          padding: 0 10px;
                          background: ${ThemingVariables.colors.primary[3]};
                          font-weight: normal;
                          white-space: nowrap;
                        `}
                        key={column.name}
                        align={isNumeric(column.displayType) && !isTimeSeries(column.displayType) ? 'right' : 'left'}
                      >
                        <Tippy content={column.sqlType} delay={300}>
                          <span> {column.render('Header')}</span>
                        </Tippy>

                        {/* Add a sort direction indicator */}
                        {column.isSorted && (
                          <IconCommonArrowLeft
                            style={{
                              width: 10,
                              lineHeight: '100%',
                              transform: column.isSortedDesc ? 'rotate(-90deg)' : 'rotate(-270deg)',
                              verticalAlign: 'middle',
                              marginLeft: 5
                            }}
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody {...getTableBodyProps()}>
                {page.map((row: unknown) => {
                  prepareRow(row)
                  return null
                })}
                {page.map((row: any, index: number) => (
                  <tr key={index.toString()} {...row.getRowProps()}>
                    {row.cells.map((cell: any) => (
                      <td
                        key={cell.column.name}
                        {...cell.getCellProps()}
                        className={cx(
                          css`
                            height: ${tableRowHeight}px;
                            padding: 0 10px;
                            font-weight: normal;
                            white-space: nowrap;
                            text-overflow: ellipsis;
                            overflow: hidden;
                            max-width: 400px;
                            font-variant-numeric: tabular-nums;
                            position: relative;
                            user-select: all;
                            .copy-icon {
                              cursor: pointer;
                              display: none;
                              position: absolute;
                              right: 10px;
                              top: 0;
                              bottom: 0;
                              margin: auto;
                              opacity: 0.8;
                            }
                            &:hover .copy-icon {
                              cursor: pointer;
                              display: inline-block;
                            }
                          `,
                          row[cell.column.order] === null
                            ? css`
                                color: ${ThemingVariables.colors.text[2]};
                              `
                            : undefined
                        )}
                        align={
                          isNumeric(cell.column.displayType) && !isTimeSeries(cell.column.displayType)
                            ? 'right'
                            : 'left'
                        }
                      >
                        <CellRenderer
                          cell={cell}
                          displayType={displayTypes[cell.column.name]}
                          displayAs={props.config.displayAs?.[cell.column.name] as DISPLAY_AS_TYPE}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className={css`
              height: ${tableRowHeight}px;
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 0 10px;
              user-select: none;
              background: ${ThemingVariables.colors.primary[4]};
            `}
          >
            <div
              className={css`
                margin-right: 10px;
              `}
            >
              {props.data.records.length}&nbsp;rows
            </div>
            <GlobalFilter
              preGlobalFilteredRows={preGlobalFilteredRows}
              globalFilter={globalFilter}
              setGlobalFilter={setGlobalFilter}
            />
            <div
              className={css`
                flex: 1;
              `}
            />
            <IconButton
              icon={IconCommonArrowUnfold}
              disabled={!canPreviousPage}
              color={ThemingVariables.colors.text[0]}
              onClick={() => {
                previousPage()
              }}
              className={css`
                margin-left: 10px;
                margin-right: 10px;
                transform: rotate(180deg);
              `}
            />
            {pageSize * pageIndex + 1}~{pageSize * (pageIndex + 1)}
            <IconButton
              icon={IconCommonArrowUnfold}
              disabled={!canNextPage}
              color={ThemingVariables.colors.text[0]}
              onClick={() => {
                nextPage()
              }}
              className={css`
                margin-left: 10px;
              `}
            />
          </div>
        </div>
      </>
    )
  }
}
