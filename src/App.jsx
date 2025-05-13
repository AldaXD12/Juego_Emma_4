// App.jsx reorganizado con modelo .glb, efecto de colisión y música de fondo funcional
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useRef, useEffect, useState, useMemo } from 'react'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import './App.css'

// Componente del auto cargado desde modelo .glb y controlado por teclas
function Auto({ modelRef, keys, isGameOver }) {
  const gltf = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}models/auto.glb`); // <-- Modifica esta línea

  useFrame((_, delta) => {
    if (!modelRef.current || isGameOver) return
    const speed = 5 * delta
    if (keys.current['w'] || keys.current['arrowup']) modelRef.current.position.z -= speed
    if (keys.current['s'] || keys.current['arrowdown']) modelRef.current.position.z += speed

    const nextX = modelRef.current.position.x + (
      (keys.current['d'] || keys.current['arrowright'] ? 1 : 0) -
      (keys.current['a'] || keys.current['arrowleft'] ? 1 : 0)
    ) * speed

    if (nextX >= -5 && nextX <= 5) {
      modelRef.current.position.x = nextX
    }
  })

  return (
    <primitive
      ref={modelRef}
      object={gltf.scene}
      position={[0, 0.1, 0]}
      scale={1.5}
    />
  )
}

// Partículas para efecto de explosión al colisionar
function Explosion({ position }) {
  const particles = useRef()
  const count = 150
  const [velocities] = useState(() => Array.from({ length: count }, () => new THREE.Vector3(
    (Math.random() - 0.5) * 2,
    (Math.random() - 0.5) * 2,
    (Math.random() - 0.5) * 2
  )))

  useFrame(() => {
    if (!particles.current) return
    const posAttr = particles.current.geometry.attributes.position
    for (let i = 0; i < count; i++) {
      posAttr.setX(i, posAttr.getX(i) + velocities[i].x * 0.1)
      posAttr.setY(i, posAttr.getY(i) + velocities[i].y * 0.1)
      posAttr.setZ(i, posAttr.getZ(i) + velocities[i].z * 0.1)
    }
    posAttr.needsUpdate = true
  })

  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = position[0]
    positions[i * 3 + 1] = position[1]
    positions[i * 3 + 2] = position[2]
  }

  return (
    <points ref={particles}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="yellow" size={0.3} />
    </points>
  )
}

// Componente de obstáculo con lógica de colisión y reinicio
function Obstacle({ targetRef, onCollision, onPassed, speed = 1, color = 'red', isGameOver }) {
  const obstacleRef = useRef()

  useFrame((_, delta) => {
    if (!obstacleRef.current || isGameOver) return
    obstacleRef.current.position.z += 4 * delta * speed

    if (obstacleRef.current.position.z > 10) {
      obstacleRef.current.position.z = -13
      obstacleRef.current.position.x = Math.random() * 10 - 5
      onPassed()
    }

    if (targetRef.current) {
      const obstacleBox = new THREE.Box3().setFromObject(obstacleRef.current)
      const playerBox = new THREE.Box3().setFromObject(targetRef.current)

      if (obstacleBox.intersectsBox(playerBox)) {
        onCollision(obstacleRef.current.position.clone())
        obstacleRef.current.position.z = -50
        obstacleRef.current.position.x = Math.random() * 10 - 5
      }
    }
  })

  return (
    <mesh ref={obstacleRef} position={[0, 0.5, -30]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

// Cámara que sigue al modelo principal
function CameraFollow({ target }) {
  const { camera } = useThree()

  useFrame(() => {
    if (!target.current) return
    const pos = target.current.position
    // Alejar la cámara en el eje Z y quizás subirla un poco
    const followPos = new THREE.Vector3(pos.x, pos.y + 1.5, pos.z + 12)
    camera.position.lerp(followPos, 0.1)
    camera.lookAt(pos)
  })

  return null
}

function Pista() {
  const edgeLineWidth = 0.2; // Ancho de las nuevas líneas de borde coloreadas
  const whiteLineWidth = 0.1; // Ancho aproximado de las líneas blancas existentes
  const centerLineWidth = 5; // Nuevo ancho para las líneas centrales blancas
  const yellowLineWidth = 0.3; // Ancho base de las líneas amarillas
  const yellowBorderWidth = 0.05; // Ancho del borde negro alrededor de las amarillas
  const laneWidth = 3.25; // Ancho del carril (distancia entre centros de líneas amarillas)

  return (
    <>
      {/* Superficie principal de la carretera (gris) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      {/* Asfalto negro entre los carriles */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[laneWidth * 2, 100]} /> {/* Ancho basado en la distancia entre líneas amarillas */}
        <meshStandardMaterial color="black" />
      </mesh>

      {/* Líneas blancas de borde (izquierda y derecha) */}
      <line position={[0, 0.005, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array([-5 - whiteLineWidth / 2, 0, -50, -5 - whiteLineWidth / 2, 0, 50])}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="white" linewidth={2} />
      </line>
      <line position={[0, 0.005, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array([5 + whiteLineWidth / 2, 0, -50, 5 + whiteLineWidth / 2, 0, 50])}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="white" linewidth={2} />
      </line>

      {/* Líneas de borde coloreadas (izquierda y derecha) */}
      <line position={[0, 0.01, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array([-5 - whiteLineWidth / 2 - edgeLineWidth, 0, -50, -5 - whiteLineWidth / 2 - edgeLineWidth, 0, 50])}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="red" linewidth={4} />
      </line>
      <line position={[0, 0.01, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array([-5 - whiteLineWidth / 2 + edgeLineWidth, 0, -50, -5 - whiteLineWidth / 2 + edgeLineWidth, 0, 50])}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="blue" linewidth={4} />
      </line>
      <line position={[0, 0.01, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array([5 + whiteLineWidth / 2 - edgeLineWidth, 0, -50, 5 + whiteLineWidth / 2 - edgeLineWidth, 0, 50])}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="red" linewidth={4} />
      </line>
      <line position={[0, 0.01, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array([5 + whiteLineWidth / 2 + edgeLineWidth, 0, -50, 5 + whiteLineWidth / 2 + edgeLineWidth, 0, 50])}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="blue" linewidth={4} />
      </line>

      {/* Líneas de carril amarillas */}
      {[-3, 0, 3].map((x) => (
        <line key={`yellow-line-${x}`} position={[0, 0.02, 0]}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array([x - yellowLineWidth / 2, 0, -50, x - yellowLineWidth / 2, 0, 50,
                                       x + yellowLineWidth / 2, 0, -50, x + yellowLineWidth / 2, 0, 50])}
              count={4}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="yellow" linewidth={10} />
        </line>
      ))}

      {/* Líneas centrales blancas discontinuas */}
      <line position={[0, 0.015, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array([-1, 0, -50, -1, 0, -45, -1, 0, -40, -1, 0, -35, -1, 0, -30, -1, 0, -25, -1, 0, -20, -1, 0, -15, -1, 0, -10, -1, 0, -5, -1, 0, 0, -1, 0, 5, -1, 0, 10, -1, 0, 15, -1, 0, 20, -1, 0, 25, -1, 0, 30, -1, 0, 35, -1, 0, 40, -1, 0, 45, -1, 0, 50])}
            count={18}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="white" linewidth={centerLineWidth} />
      </line>
      <line position={[0, 0.015, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={new Float32Array([1, 0, -50, 1, 0, -45, 1, 0, -40, 1, 0, -35, 1, 0, -30, 1, 0, -25, 1, 0, -20, 1, 0, -15, 1, 0, -10, 1, 0, -5, 1, 0, 0, 1, 0, 5, 1, 0, 10, 1, 0, 15, 1, 0, 20, 1, 0, 25, 1, 0, 30, 1, 0, 35, 1, 0, 40, 1, 0, 45, 1, 0, 50])}
            count={18}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="white" linewidth={centerLineWidth} />
      </line>
    </>
  );
}


// Lista de 20 niveles progresivos
const niveles = Array.from({ length: 20 }, (_, i) => ({
  meta: (i + 1) * 5,
  color: `hsl(${i * 18}, 100%, 50%)`,
  filas: 5 + i,
  velocidad: 1 + i * 0.05
}))

// Componente principal que administra el juego
function App() {
  const modelRef = useRef()
  const keys = useRef({})
  const [explosions, setExplosions] = useState([])
  const [lives, setLives] = useState(5)
  const [message, setMessage] = useState('')
  const [time, setTime] = useState(0)
  const [isGameOver, setIsGameOver] = useState(false)
  const [obstaculosPasados, setObstaculosPasados] = useState(0)
  const [nivelIndex, setNivelIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [started, setStarted] = useState(false)
  const audioRef = useRef(null)
  const musicRef = useRef(null)

  const nivelActual = niveles[nivelIndex] || niveles[niveles.length - 1]

  // Reproduce o pausa la música según el estado del juego
  useEffect(() => {
    if (started && !isGameOver) {
      musicRef.current?.play()
    } else {
      musicRef.current?.pause()
      musicRef.current.currentTime = 0
    }
  }, [started, isGameOver])

  useEffect(() => {
    const down = (e) => (keys.current[e.key.toLowerCase()] = true)
    const up = (e) => (keys.current[e.key.toLowerCase()] = false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isGameOver && started && !paused) setTime((t) => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [isGameOver, started, paused])

  useEffect(() => {
    if (lives <= 0) {
      setIsGameOver(true)
      setMessage('💀 GAME OVER')
    }
  }, [lives])

  useEffect(() => {
    if (obstaculosPasados >= nivelActual.meta && nivelIndex < niveles.length - 1) {
      setNivelIndex((n) => n + 1)
      setMessage(`✅ Nivel ${nivelIndex + 2}`)
      setTimeout(() => setMessage(''), 1500)
    } else if (nivelIndex === niveles.length - 1 && obstaculosPasados >= nivelActual.meta) {
      setMessage('🎉 GANADOR HDSPT')
      setIsGameOver(true)
    }
  }, [obstaculosPasados])

  const handleCollision = (position) => {
    if (isGameOver || paused) return
    setExplosions((prev) => [...prev, { id: Date.now(), position }])
    setMessage('💥 ¡Colisión!')
    setLives((l) => Math.max(0, l - 1))
    if (modelRef.current) modelRef.current.position.set(0, 0.1, 0)
    if (audioRef.current) audioRef.current.play()
    setTimeout(() => {
      setExplosions((prev) => prev.slice(1))
      if (lives > 1) setMessage('')
    }, 1000)
  }

  const handlePassed = () => {
    if (!isGameOver && !paused) setObstaculosPasados((s) => s + 1)
  }

  const resetGame = () => {
    setLives(5)
    setTime(0)
    setMessage('')
    setObstaculosPasados(0)
    setNivelIndex(0)
    setIsGameOver(false)
    setPaused(false)
    setStarted(false)
    if (modelRef.current) modelRef.current.position.set(0, 0.1, 0)
  }
  ///////////////////////
  const handleMoveStart = (direction) => {
    if (!started || isGameOver || paused) return;
    switch (direction) {
      case 'up':
        keys.current['w'] = true;
        keys.current['arrowup'] = true;
        break;
      case 'down':
        keys.current['s'] = true;
        keys.current['arrowdown'] = true;
        break;
      case 'left':
        keys.current['a'] = true;
        keys.current['arrowleft'] = true;
        break;
      case 'right':
        keys.current['d'] = true;
        keys.current['arrowright'] = true;
        break;
      default:
        break;
    }
  };

  const handleMoveEnd = () => {
    keys.current['w'] = false;
    keys.current['arrowup'] = false;
    keys.current['s'] = false;
    keys.current['arrowdown'] = false;
    keys.current['a'] = false;
    keys.current['arrowleft'] = false;
    keys.current['d'] = false;
    keys.current['arrowright'] = false;
  };

////////////////////////
  return (
    <>
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/choque.mp3`} preload="auto" />
      <audio ref={musicRef} src={`${import.meta.env.BASE_URL}audio/music2.mp3`} preload="auto" loop />
      <Canvas shadows camera={{ position: [0, 1, 12], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
        <Suspense fallback={null}>
          <Pista />
          {started && (
            <>
              <Auto modelRef={modelRef} keys={keys} isGameOver={isGameOver} />
              {!isGameOver && Array.from({ length: nivelActual.filas }).map((_, i) => (
                <Obstacle
                  key={i}
                  targetRef={modelRef}
                  onCollision={handleCollision}
                  onPassed={handlePassed}
                  speed={nivelActual.velocidad}
                  color={nivelActual.color}
                  isGameOver={isGameOver}
                />
              ))}
              <CameraFollow target={modelRef} />
              {explosions.map((e) => (
                <Explosion key={e.id} position={[e.position.x, e.position.y, e.position.z]} />
              ))}
            </>
          )}
        </Suspense>
      </Canvas>

      {message && <div className="message">{message}</div>} {/* Mueve el mensaje fuera del hud */}
      <div className="hud">
        {!started && <button onClick={() => setStarted(true)}>▶️ Iniciar Juego</button>}
        {started && !isGameOver && (
          <button onClick={() => setPaused((p) => !p)}>{paused ? '▶️ Reanudar' : '⏸️ Pausar'}</button>
        )}
        {isGameOver && <button className="reset-button" onClick={resetGame}>🔁 Reiniciar Juego</button>}
      </div>
      {/* ... (El resto de tu JSX) */}
      <div className="touch-controls">
        <button
          className="touch-button up-button"
          onTouchStart={() => handleMoveStart('up')}
          onTouchEnd={handleMoveEnd}
          onMouseUp={handleMoveEnd}
          onMouseLeave={handleMoveEnd}
        >
          Arriba
        </button>
        <div className="touch-button-row">
          <button
            className="touch-button left-button"
            onTouchStart={() => handleMoveStart('left')}
            onTouchEnd={handleMoveEnd}
            onMouseUp={handleMoveEnd}
            onMouseLeave={handleMoveEnd}
          >
            Izquierda
          </button>
          <button
            className="touch-button right-button"
            onTouchStart={() => handleMoveStart('right')}
            onTouchEnd={handleMoveEnd}
            onMouseUp={handleMoveEnd}
            onMouseLeave={handleMoveEnd}
          >
            Derecha
          </button>
        </div>
        <button
          className="touch-button down-button"
          onTouchStart={() => handleMoveStart('down')}
          onTouchEnd={handleMoveEnd}
          onMouseUp={handleMoveEnd}
          onMouseLeave={handleMoveEnd}
        >
          Abajo
        </button>
      </div>
    </>
  )
}

export default App;
