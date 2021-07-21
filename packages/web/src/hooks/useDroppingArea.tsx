import { useRecoilState, useRecoilValue } from 'recoil'
import { BlockDroppingArea, DroppingArea } from '../context/blockDnd'

export const useDroppingArea = () => {
  return useRecoilState(DroppingArea)
}

export const useDroppingAreaBlock = (id: string) => {
  const droppingArea = useRecoilValue(BlockDroppingArea(id))
  return droppingArea
}