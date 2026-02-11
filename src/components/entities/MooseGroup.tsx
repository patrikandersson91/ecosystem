import { useEcosystem } from '../../state/ecosystem-context.tsx'
import Moose from './Moose.tsx'

export default function MooseGroup() {
  const { moose } = useEcosystem()

  return (
    <>
      {moose.map(m => (
        <Moose key={m.id} data={m} />
      ))}
    </>
  )
}
