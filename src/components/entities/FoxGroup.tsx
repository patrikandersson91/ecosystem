import { useEcosystem } from '../../state/ecosystem-context.tsx'
import Fox from './Fox.tsx'

export default function FoxGroup() {
  const { foxes } = useEcosystem()

  return (
    <>
      {foxes.map(fox => (
        <Fox key={fox.id} data={fox} />
      ))}
    </>
  )
}
