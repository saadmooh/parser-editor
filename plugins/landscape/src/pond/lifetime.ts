import type { Group } from 'three'
import { disposePondGeometry } from './geometry'

const owners = new WeakMap<Group, { count: number; revision: number }>()

/** React may replay setup/cleanup with the same memoized pond in StrictMode. */
export function retainPondGeometry(group: Group): () => void {
  let owner = owners.get(group)
  if (!owner) {
    owner = { count: 0, revision: 0 }
    owners.set(group, owner)
  }
  owner.count++
  owner.revision++
  let released = false
  return () => {
    if (released) return
    released = true
    owner.count--
    const revision = ++owner.revision
    // Wait until React finishes the commit/replay. Immediate re-acquisition
    // cancels disposal; real removal releases the resources after detachment.
    queueMicrotask(() => {
      if (owner.count !== 0 || owner.revision !== revision) return
      owners.delete(group)
      disposePondGeometry(group)
    })
  }
}
