import { useEcosystem } from '../../state/ecosystem-context.tsx'
import Rabbit from './Rabbit.tsx'

export default function RabbitGroup() {
  const { rabbits } = useEcosystem()

  return (
    <>
      {rabbits.map(rabbit => (
        <Rabbit key={rabbit.id} data={rabbit} />
      ))}
    </>
  )
}
