import { useRabbitIds } from '../../state/ecosystem-context.tsx'
import Rabbit from './Rabbit.tsx'

export default function RabbitGroup() {
  const rabbitIds = useRabbitIds()

  return (
    <>
      {rabbitIds.map(id => (
        <Rabbit key={id} id={id} />
      ))}
    </>
  )
}
