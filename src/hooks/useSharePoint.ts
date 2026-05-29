import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { setTokenGetter, spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { setGraphTokenGetter } from '../services/graph'

export function useSharePoint() {
  const { getToken } = useAuth()

  const init = useCallback(() => {
    setTokenGetter(getToken)
    setGraphTokenGetter(getToken)
  }, [getToken])

  return { init, spGet, spCreate, spUpdate, spDelete }
}
