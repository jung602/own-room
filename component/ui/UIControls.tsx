import React, { useState } from 'react'
import { Shape, MAX_SHAPES, ShapeType, shapeDisplayNames } from '../scene/assets/shapes'

interface UIControlsProps {
  shapes: Shape[]
  onAddShape: (shapeType: ShapeType) => void
  onDeleteShape: (id: string) => void
  onToggleOperation: (id: string) => void
  onAddBox?: () => void
}

export function UIControls({
  shapes,
  onAddShape,
  onDeleteShape,
  onToggleOperation,
  onAddBox
}: UIControlsProps) {
  const [selectedShapeType, setSelectedShapeType] = useState<ShapeType>('sphere')
  
  const shapeTypes: ShapeType[] = ['sphere', 'box', 'torus', 'roundCone', 'capsule', 'cylinder']
  
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto">
        {/* Shape List */}
        {shapes.length > 0 && (
          <div className="mb-4 space-y-2">
            {shapes.map((shape) => (
              <div
                key={shape.id}
                className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 flex items-center justify-between"
              >
                <span className="text-white font-medium">
                  {shapeDisplayNames[shape.shapeType]} {shape.id}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onToggleOperation(shape.id)}
                    className={`px-4 py-2 rounded-md font-medium transition-colors ${
                      shape.operation === 'union'
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    {shape.operation === 'union' ? 'Union' : 'Subtract'}
                  </button>
                  <button
                    onClick={() => onDeleteShape(shape.id)}
                    className="px-4 py-2 rounded-md font-medium transition-colors bg-gray-600 hover:bg-gray-700 text-white"
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
          {/* Shape Type Selector */}
          <select
            value={selectedShapeType}
            onChange={(e) => setSelectedShapeType(e.target.value as ShapeType)}
            className="px-4 py-3 rounded-lg font-medium transition-colors bg-gray-700 hover:bg-gray-600 text-white cursor-pointer"
          >
            {shapeTypes.map((type) => (
              <option key={type} value={type}>
                {shapeDisplayNames[type]}
              </option>
            ))}
          </select>
          
          <button
            onClick={() => onAddShape(selectedShapeType)}
            disabled={shapes.length >= MAX_SHAPES}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              shapes.length >= MAX_SHAPES
                ? 'bg-gray-500 cursor-not-allowed text-gray-300'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            Add Shape {shapes.length >= MAX_SHAPES ? '(Max Reached)' : ''}
          </button>
          
          {onAddBox && (
            <button
              onClick={onAddBox}
              className="px-6 py-3 rounded-lg font-medium transition-colors bg-orange-500 hover:bg-orange-600 text-white"
            >
              Add Box
            </button>
          )}
          
        </div>
      </div>
    </div>
  )
}

