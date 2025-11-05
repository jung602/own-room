import { ReactNode } from 'react'
import { Physics } from '@react-three/cannon'

interface PhysicsSceneProps {
  children: ReactNode
}

export function PhysicsScene({ children }: PhysicsSceneProps) {
  return (
    <Physics
      gravity={[0, -9.8, 0]}
      iterations={10}
      tolerance={0.0001}
      defaultContactMaterial={{
        friction: 0.3,
        restitution: 0.3,
      }}
    >
      {children}
    </Physics>
  )
}

