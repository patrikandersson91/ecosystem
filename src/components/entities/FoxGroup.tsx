import { useFoxIds } from '../../state/ecosystem-context.tsx'
import Fox from './Fox.tsx'

export default function FoxGroup() {
  const foxIds = useFoxIds()

  return (
    <>
      {foxIds.map(id => (
        <Fox key={id} id={id} />
      ))}
    </>
  )
}
