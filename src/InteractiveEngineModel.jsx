import React, { useState, useMemo } from 'react';
import { useGLTF, Center, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function InteractiveEngineModel({ onSelectComponent, explosionFactor, hoveredMeshName, setHoveredMeshName }) {
  // Load GLB model
  const { scene } = useGLTF('/turbojet.glb');
  
  // Track hovered state
  const [hoveredNode, setHoveredNode] = useState(null); // The exact leaf mesh
  const [hoveredStage, setHoveredStage] = useState(null); // 'compressor', 'combustor', or 'turbine'
  const [tooltipPos, setTooltipPos] = useState([0, 0, 0]);

  // Clone scene, auto-scale, and compute relative coordinate displacements
  const { clonedScene, scale, axis, partsContainer, nativeMaxDim, hitboxCenters } = useMemo(() => {
    const clone = scene.clone();
    
    // Compute bounding box in native unscaled units
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const calculatedScale = maxDim > 0 ? 4.5 / maxDim : 1.0;
    
    clone.updateMatrixWorld(true);

    // Auto-detect longitudinal axis
    let modelAxis = 'x';
    let maxLen = size.x;
    if (size.y > maxLen) {
      modelAxis = 'y';
      maxLen = size.y;
    }
    if (size.z > maxLen) {
      modelAxis = 'z';
      maxLen = size.z;
    }

    const modelCenter = new THREE.Vector3();
    box.getCenter(modelCenter);

    // Find assembly parts container node (children.length > 2)
    let containerNode = clone;
    clone.traverse((node) => {
      if (node.children && node.children.length > 2) {
        containerNode = node;
      }
    });

    const tempBox = new THREE.Box3();
    const tempCenter = new THREE.Vector3();

    // Prepare components and clone materials so we can make them glow independently
    containerNode.children.forEach((child) => {
      child.userData.axis = modelAxis;
      child.userData.originalAxisVal = child.position[modelAxis];
      
      tempBox.setFromObject(child);
      tempBox.getCenter(tempCenter);
      
      const relativeVal = tempCenter[modelAxis] - modelCenter[modelAxis];
      child.userData.relativeVal = relativeVal;

      // Classify the component's stage
      if (relativeVal < -0.2 * maxDim) {
        child.userData.stage = 'compressor';
      } else if (relativeVal > 0.2 * maxDim) {
        child.userData.stage = 'turbine';
      } else {
        child.userData.stage = 'combustor';
      }

      // Clone materials to prevent shared-cache material changes
      child.traverse((subNode) => {
        if (subNode.isMesh && subNode.material) {
          subNode.material = subNode.material.clone();
        }
      });
    });

    // Calculate hitbox locations
    let compSum = 0, compCount = 0;
    let combSum = 0, combCount = 0;
    let turbSum = 0, turbCount = 0;
    
    containerNode.children.forEach((child) => {
      const relVal = child.userData.relativeVal;
      if (child.userData.stage === 'compressor') {
        compSum += relVal;
        compCount++;
      } else if (child.userData.stage === 'turbine') {
        turbSum += relVal;
        turbCount++;
      } else {
        combSum += relVal;
        combCount++;
      }
    });

    const compCenter = compCount > 0 ? compSum / compCount : -0.25 * maxDim;
    const combCenter = combCount > 0 ? combSum / combCount : 0;
    const turbCenter = turbCount > 0 ? turbSum / turbCount : 0.25 * maxDim;

    return {
      clonedScene: clone,
      scale: calculatedScale,
      axis: modelAxis,
      partsContainer: containerNode,
      nativeMaxDim: maxDim,
      hitboxCenters: { compCenter, combCenter, turbCenter }
    };
  }, [scene]);

  // R3F Render loop to slide components and update emissive glows
  useFrame(() => {
    const explodeMultiplier = 2.5; 

    // 1. Position components
    partsContainer.children.forEach((child) => {
      if (child.userData.originalAxisVal !== undefined) {
        const activeAxis = child.userData.axis;
        const relativeVal = child.userData.relativeVal;
        
        const destVal = child.userData.originalAxisVal + (relativeVal * explosionFactor * explodeMultiplier);
        child.position[activeAxis] = THREE.MathUtils.lerp(child.position[activeAxis], destVal, 0.15);
      }
    });

    // 2. Animate mesh glows on hover (glows entire stage together)
    partsContainer.children.forEach((child) => {
      const isStageHovered = hoveredStage && child.userData.stage === hoveredStage;
      
      child.traverse((subNode) => {
        if (subNode.isMesh && subNode.material) {
          if (subNode.material.emissive) {
            const targetColor = isStageHovered ? new THREE.Color(0x00ffff) : new THREE.Color(0x000000);
            subNode.material.emissive.lerp(targetColor, 0.15);
            subNode.material.emissiveIntensity = isStageHovered ? 1.0 : 0.0;
          }
        }
      });
    });
  });

  // Convert node name to user-friendly label
  const cleanName = (name) => {
    if (!name) return "Unknown Component";
    return name
      .replace(/_/g, ' ')
      .replace(/\^/g, ' ')
      .replace(/jet engine/gi, '')
      .replace(/assembly/gi, '')
      .trim();
  };

  // Raycast hover actions
  const handlePointerOver = (e) => {
    e.stopPropagation();
    
    // Find the exact intersected leaf mesh
    let mesh = e.object;
    while (mesh && !mesh.isMesh) {
      mesh = mesh.parent;
    }
    
    if (mesh && mesh.name) {
      setHoveredNode(mesh);
      setHoveredMeshName(mesh.name);
      document.body.style.cursor = 'pointer';
      
      // Find which top-level stage this mesh belongs to
      let topNode = mesh;
      while (topNode && topNode.parent && topNode.parent !== partsContainer) {
        topNode = topNode.parent;
      }
      
      if (topNode && topNode.userData.stage) {
        setHoveredStage(topNode.userData.stage);
      }
      
      // Calculate tooltip position in world space
      const box = new THREE.Box3().setFromObject(mesh);
      const center = new THREE.Vector3();
      box.getCenter(center);
      setTooltipPos([center.x, center.y + 0.6, center.z]);
    }
  };

  const handlePointerOut = (e) => {
    e.stopPropagation();
    setHoveredNode(null);
    setHoveredMeshName(null);
    setHoveredStage(null);
    document.body.style.cursor = 'auto';
  };

  const handleSelect = (e) => {
    e.stopPropagation();
    let node = e.object;
    while (node && node.parent && node.parent !== partsContainer) {
      node = node.parent;
    }
    if (node && node.userData.stage && onSelectComponent) {
      onSelectComponent(node.userData.stage);
    }
  };

  // Sync hitbox coordinates in native unscaled space
  const currentOffset = explosionFactor * 2.5;
  const compPos = hitboxCenters.compCenter + (hitboxCenters.compCenter * currentOffset);
  const combPos = hitboxCenters.combCenter;
  const turbPos = hitboxCenters.turbCenter + (hitboxCenters.turbCenter * currentOffset);

  // Dynamic cylinder dimensions
  const cylinderRadius = 0.15 * nativeMaxDim;
  const cylinderHeight = 0.25 * nativeMaxDim;

  return (
    <group scale={scale}>
      {/* 1. Render scaled 3D model */}
      <Center>
        <primitive 
          object={clonedScene}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleSelect}
        />
      </Center>

      {/* 2. Interactive Cylinder Hitboxes for the main 3 components */}
      {/* Compressor Hitbox (Front / Left) */}
      <mesh
        position={[axis === 'x' ? compPos : 0, axis === 'y' ? compPos : 0, axis === 'z' ? compPos : 0]}
        rotation={axis === 'x' ? [0, 0, Math.PI / 2] : (axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0])}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredStage('compressor');
        }}
        onPointerOut={handlePointerOut}
        onClick={(e) => {
          e.stopPropagation();
          if (onSelectComponent) onSelectComponent('compressor');
        }}
      >
        <cylinderGeometry args={[cylinderRadius, cylinderRadius, cylinderHeight, 16]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={hoveredStage === 'compressor' ? 0.35 : 0}
          wireframe
        />
      </mesh>

      {/* Combustor Hitbox (Middle) */}
      <mesh
        position={[0, 0, 0]}
        rotation={axis === 'x' ? [0, 0, Math.PI / 2] : (axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0])}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredStage('combustor');
        }}
        onPointerOut={handlePointerOut}
        onClick={(e) => {
          e.stopPropagation();
          if (onSelectComponent) onSelectComponent('combustor');
        }}
      >
        <cylinderGeometry args={[cylinderRadius * 0.9, cylinderRadius * 0.9, cylinderHeight, 16]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={hoveredStage === 'combustor' ? 0.35 : 0}
          wireframe
        />
      </mesh>

      {/* Turbine Hitbox (Rear / Right) */}
      <mesh
        position={[axis === 'x' ? turbPos : 0, axis === 'y' ? turbPos : 0, axis === 'z' ? turbPos : 0]}
        rotation={axis === 'x' ? [0, 0, Math.PI / 2] : (axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0])}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredStage('turbine');
        }}
        onPointerOut={handlePointerOut}
        onClick={(e) => {
          e.stopPropagation();
          if (onSelectComponent) onSelectComponent('turbine');
        }}
      >
        <cylinderGeometry args={[cylinderRadius, cylinderRadius * 0.8, cylinderHeight, 16]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={hoveredStage === 'turbine' ? 0.35 : 0}
          wireframe
        />
      </mesh>

      {/* Futuristic Hover Tooltip */}
      {hoveredNode && (
        <Html position={tooltipPos} center distanceFactor={6}>
          <div style={{
            background: 'rgba(6, 9, 17, 0.9)',
            border: '1px solid var(--accent-cyan)',
            padding: '5px 10px',
            borderRadius: '4px',
            color: 'var(--accent-cyan)',
            fontSize: '9px',
            fontWeight: 'bold',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.5)',
            pointerEvents: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {cleanName(hoveredNode.name)}
          </div>
        </Html>
      )}
    </group>
  );
}

// Preload GLTF Model
useGLTF.preload('/turbojet.glb');
