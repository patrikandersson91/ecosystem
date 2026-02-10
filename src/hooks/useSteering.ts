import { useRef, useCallback } from 'react'
import { Vector3 } from 'three'

interface UseSteeringOptions {
  maxSpeed: number
  maxForce: number
  mass?: number
  wanderRadius?: number
  wanderDistance?: number
  wanderJitter?: number
}

export function useSteering(options: UseSteeringOptions) {
  const {
    maxSpeed,
    maxForce,
    mass = 1,
    wanderRadius = 1.5,
    wanderDistance = 3,
    wanderJitter = 0.3,
  } = options

  const wanderAngle = useRef(Math.random() * Math.PI * 2)
  const _desired = useRef(new Vector3())
  const _steering = useRef(new Vector3())

  const seek = useCallback(
    (position: Vector3, velocity: Vector3, target: Vector3): Vector3 => {
      _desired.current.subVectors(target, position).normalize().multiplyScalar(maxSpeed)
      _steering.current.subVectors(_desired.current, velocity)
      _steering.current.clampLength(0, maxForce)
      return _steering.current.clone()
    },
    [maxSpeed, maxForce],
  )

  const flee = useCallback(
    (position: Vector3, velocity: Vector3, threat: Vector3, panicRadius: number): Vector3 => {
      const dist = position.distanceTo(threat)
      if (dist > panicRadius || dist < 0.001) return new Vector3(0, 0, 0)

      const urgency = 1 - dist / panicRadius
      _desired.current
        .subVectors(position, threat)
        .normalize()
        .multiplyScalar(maxSpeed * (1 + urgency))
      _steering.current.subVectors(_desired.current, velocity)
      _steering.current.clampLength(0, maxForce * (1 + urgency))
      return _steering.current.clone()
    },
    [maxSpeed, maxForce],
  )

  const wander = useCallback(
    (position: Vector3, velocity: Vector3): Vector3 => {
      wanderAngle.current += (Math.random() - 0.5) * wanderJitter

      const speed = velocity.length()
      const forward =
        speed > 0.01
          ? velocity.clone().normalize().multiplyScalar(wanderDistance)
          : new Vector3(Math.cos(wanderAngle.current), 0, Math.sin(wanderAngle.current)).multiplyScalar(wanderDistance)

      const circleCenter = position.clone().add(forward)
      const offset = new Vector3(
        Math.cos(wanderAngle.current) * wanderRadius,
        0,
        Math.sin(wanderAngle.current) * wanderRadius,
      )

      const target = circleCenter.add(offset)
      return seek(position, velocity, target)
    },
    [wanderDistance, wanderRadius, wanderJitter, seek],
  )

  const applyForces = useCallback(
    (position: Vector3, velocity: Vector3, force: Vector3, delta: number): void => {
      const ax = force.x / mass
      const az = force.z / mass

      velocity.x += ax * delta
      velocity.z += az * delta
      velocity.y = 0
      velocity.clampLength(0, maxSpeed)

      position.x += velocity.x * delta
      position.z += velocity.z * delta
    },
    [mass, maxSpeed],
  )

  return { seek, flee, wander, applyForces }
}
