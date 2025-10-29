import React from 'react'
import { Sphere, MAX_SPHERES } from '../assets/spheres'

interface UIControlsProps {
  spheres: Sphere[]
  onAddSphere: () => void
  onDeleteSphere: (id: string) => void
  onToggleOperation: (id: string) => void
  onConfirmColliders?: () => void
  onAddBox?: () => void
  collidersConfirmed?: boolean
  showColliderWireframe?: boolean
  onToggleColliderWireframe?: () => void
}

export function UIControls({
  spheres,
  onAddSphere,
  onDeleteSphere,
  onToggleOperation,
  onConfirmColliders,
  onAddBox,
  collidersConfirmed = false,
  showColliderWireframe = true,
  onToggleColliderWireframe
}: UIControlsProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto">
        {/* Sphere List */}
        {spheres.length > 0 && (
          <div className="mb-4 space-y-2">
            {spheres.map((sphere) => (
              <div
                key={sphere.id}
                className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 flex items-center justify-between"
              >
                <span className="text-white font-medium">
                  Sphere {sphere.id}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onToggleOperation(sphere.id)}
                    disabled={collidersConfirmed}
                    className={`px-4 py-2 rounded-md font-medium transition-colors ${
                      collidersConfirmed
                        ? 'bg-gray-500 cursor-not-allowed text-gray-300'
                        : sphere.operation === 'union'
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    {sphere.operation === 'union' ? 'Union' : 'Subtract'}
                  </button>
                  <button
                    onClick={() => onDeleteSphere(sphere.id)}
                    disabled={collidersConfirmed}
                    className={`px-4 py-2 rounded-md font-medium transition-colors ${
                      collidersConfirmed
                        ? 'bg-gray-500 cursor-not-allowed text-gray-300'
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Control Buttons */}
        <div className="flex justify-center gap-3">
          <button
            onClick={onAddSphere}
            disabled={spheres.length >= MAX_SPHERES || collidersConfirmed}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              spheres.length >= MAX_SPHERES || collidersConfirmed
                ? 'bg-gray-500 cursor-not-allowed text-gray-300'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            Add Sphere {spheres.length >= MAX_SPHERES ? '(Max Reached)' : collidersConfirmed ? '(Locked)' : ''}
          </button>
          
          {onConfirmColliders && (
            <button
              onClick={onConfirmColliders}
              disabled={collidersConfirmed}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                collidersConfirmed
                  ? 'bg-green-500 text-white cursor-not-allowed'
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
              }`}
            >
              {collidersConfirmed ? 'Colliders Active' : 'Confirm Colliders'}
            </button>
          )}
          
          {onAddBox && (
            <button
              onClick={onAddBox}
              disabled={!collidersConfirmed}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                !collidersConfirmed
                  ? 'bg-gray-500 cursor-not-allowed text-gray-300'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
            >
              Add Box
            </button>
          )}
          
          {onToggleColliderWireframe && collidersConfirmed && (
            <button
              onClick={onToggleColliderWireframe}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                showColliderWireframe
                  ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              {showColliderWireframe ? 'Hide Colliders' : 'Show Colliders'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

