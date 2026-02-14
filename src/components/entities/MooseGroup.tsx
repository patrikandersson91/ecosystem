import { useMooseIds } from '../../state/ecosystem-context.tsx'
import Moose from './Moose.tsx'

export default function MooseGroup() {
  const mooseIds = useMooseIds()

  return (
    <>
      {mooseIds.map(id => (
        <Moose key={id} id={id} />
      ))}
    </>
  )
}
