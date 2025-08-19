// Warm Solar Astral — camera-relative WASD + comfy cam + suck-in + FS shell console
// ----------------------------------------------------------------------------------
import * as THREE from 'three'
import React, { useMemo, useRef, useState, useEffect, useMemo as useMemoReact } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Icosahedron, Dodecahedron, TorusKnot, Sparkles, QuadraticBezierLine, Float } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette, GodRays } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'

const PALETTE = {
  bg: '#0a0603',
  wire: '#ffcc7a',
  sunCore: '#ffd089',
  sunHot: '#ff9b32',
}

const SOLAR_PRESET = {
  "/": {
      "plaque.md":
`# Inter-galactic monument to Sol !
A monument to humanity. Who ascended from the dark ages to the solar age ! LUX !
`
    ,
    "history": {
      "2009 — The Seed That Owned No One.md":
`Bitcoin proves voluntary coordination at planetary scale without kings or gates.
Not exit money — starter culture for sovereign networks.
Motto: "In the beginning, a signal. In you, an answer."`,
      "2024 — The First Network State.md":
`The first credible proto-state born from network coordination and shared ledgers.
Standards, identity, arbitration — all bootstrapped in code and culture.

Motto: “Even a billion cells start from a single seed.”`,
'2027 — The Speciation Event — The second milestone':
`The singularity is in early takeoff, psycho-technology is reaching new heights. 
24/7 brain signal processing allows for open source fine grained control over mind states. 
Bliss becomes cheap, rapid fall in violence and aggression follows. Solar efficiency becomes massive. 
Fusion (both hot and cold, Pons hosts a large “I told you so” conference/celebration ) is solved and rapid manufacturing become too cheap to meter. 
There was no collapse of the state, rather a gradual lack of dependence. 

However, the shift from scarcity to abundance allowed the collective psyche to breathe a sigh of relief. 
Memetic speciation experts mark this year as the beginning of the end for the pre-solarian meme pool and the beginning of the post-solarian meme pool

Motto: “Many minds, one warmth.”`,
'2046 — The Severance':
`Complete biological reprogramming in situ proved harder than expected. 
It was however fears of losing “humanity” that led to the moratoriums on trans-humanist practices and radical DNA altering which were lifted in 2046. 
By this point in time, a 50% linguistic/memetic separation would exist between pre-singularity and post-singularity homo sapiens. 

Motto: “Compost the fear. Grow the future.” `,
'2072 — The Hard Problem':
`A search based ASI proof came to prove the hard problem of consciousness is incomputable in Classical, Quantum and thermodynamic computers, 
some intelligence clusters (both silicon and semi-biological) are attempting to pose relativistic computing with non-local time as a solution,
but it remains an open question… 

Motto: “Final frontier or new beginning.”`


    },
    "logs": {
      "2125-08-16.log": "Bitcoin Core v5232.22 released. Updating",
      "2125-08-15.log": "Handshake OK. Dust density nominal.",
      "2125-08-18.log": "Ribbon coherence ↑. User node shimmering."
    },
    "oracle": {
      "signal.txt": "In the beginning, a signal. In you, an answer."
    },
    "readme.txt": "Root readme. Try /solar/plaque.md or /history/…"
  }
}

  

// Gravity & capture (XZ-plane)
const GRAVITY_RADIUS = 3.6
const CAPTURE_RADIUS = 1.05

export default function App() {
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [consoleFullscreen, setConsoleFullscreen] = useState(false)
  const [capturedSignal, setCapturedSignal] = useState(false)
  const sunRef = useRef(null)

  return (
    <div style={{ width: '100vw', height: '100vh', background: PALETTE.bg }}>
      <Canvas dpr={[1, 2]} camera={{ fov: 60, position: [0, 4.2, 7.8] }} gl={{ antialias: true, alpha: true }}>
        <color attach="background" args={[PALETTE.bg]} />
        <Sun sunRef={sunRef} />
        <UserLight onCaptured={() => { setConsoleFullscreen(true); setConsoleOpen(true); setCapturedSignal(true) }} />
        <AstralWireframes />
        <EnergyRibbons />
        <Sparkles count={1000} size={2.5} speed={0.12} opacity={0.6} color={PALETTE.wire} scale={[40, 40, 40]} />
        <Effects sunRef={sunRef} />
      </Canvas>

      <WasdHint palette={PALETTE} hidden={consoleOpen} />

      {consoleOpen && (
        <SolarConsole
          onClose={() => setConsoleOpen(false)}
          fullscreen={consoleFullscreen}
          palette={PALETTE}
          preset={SOLAR_PRESET}
        />

      )}

      <AudioManager
        introUrl="/audio/intro.mp3"
        loopUrl="/audio/loop.mp3"
        startOnCapture={capturedSignal}   // auto-start if player gets sucked in
        volume={0.65}                     // 0..1
        crossfadeSec={2.5}
      />
    </div>
  )
}

/** SUN (emissive, breathing, godrays handle) */
function Sun({ sunRef }) {
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const s = 0.8 + Math.sin(t * 0.7) * 0.05
    if (sunRef.current) sunRef.current.scale.setScalar(s)
  })

  return (
    <group>
      <mesh ref={sunRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.85, 96, 96]} />
        <meshBasicMaterial color={PALETTE.sunCore} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.95, 64, 64]} />
        <meshBasicMaterial color={PALETTE.sunHot} transparent opacity={0.15} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={2.2} color={PALETTE.sunHot} distance={25} />
    </group>
  )
}

/** USER LIGHT — camera-relative WASD on XZ, comfy chase cam, shimmer, shitty gravity; FREEZE camera on capture */
function UserLight({ onCaptured }) {
  const group = useRef(null)
  const coreMat = useRef(null)
  const haloMat = useRef(null)
  const auraMat = useRef(null)
  const ring = useRef(null)

  const pos = useRef(new THREE.Vector3(2, -20.0, 30))
  const vel = useRef(new THREE.Vector3())
  const lastMoveDir = useRef(new THREE.Vector3(0, 0, -1))
  const lookDir = useRef(new THREE.Vector3(0, 0, -1))
  const keys = useRef({ w: false, a: false, s: false, d: false })
  const captured = useRef(false)

  // camera freeze
  const camFrozen = useRef(false)
  const camPos = useRef(new THREE.Vector3())
  const camQuat = useRef(new THREE.Quaternion())

  // movement feel
  const ACCEL = 12.0
  const DAMP  = 0.90
  const MAX_SPEED = 7.0

  // camera feel
  const BASE_HEIGHT = 3.8
  const BASE_BACK   = 10.6
  const MAX_HEIGHT  = 6.2
  const MAX_BACK    = 8.8

  const tmp = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)

  useEffect(() => {
    const down = (e) => { const k = e.key.toLowerCase(); if (k in keys.current) keys.current[k] = true }
    const upH  = (e) => { const k = e.key.toLowerCase(); if (k in keys.current) keys.current[k] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', upH)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', upH) }
  }, [])

  // fBm-ish flicker
  const fbm = (t) => {
    const a = Math.sin(t * 1.73 + 0.2)
    const b = Math.sin(t * 2.97 + 1.1)
    const c = Math.sin(t * 4.31 + 2.7)
    return (a + b * 0.6 + c * 0.33) / (1 + 0.6 + 0.33) * 0.5 + 0.5
  }

  useFrame(({ camera, clock }, dt) => {
    const t = clock.getElapsedTime()
    const dtc = Math.min(dt, 1 / 30)

    // --- camera-relative input (WASD) ---
    const camForward = new THREE.Vector3()
    camera.getWorldDirection(camForward)
    camForward.y = 0; camForward.normalize()
    const camRight = new THREE.Vector3().crossVectors(camForward, up).normalize()

    const inputX = (keys.current.d ? 1 : 0) - (keys.current.a ? 1 : 0)
    const inputZ = (keys.current.w ? 1 : 0) - (keys.current.s ? 1 : 0)

    tmp.set(0,0,0).addScaledVector(camRight, inputX).addScaledVector(camForward, inputZ)

    if (!captured.current && tmp.lengthSq() > 0) {
      tmp.normalize().multiplyScalar(ACCEL * dtc)
      vel.current.add(tmp)
      lastMoveDir.current.copy(tmp).setLength(1)
      const backOnly = (inputZ < 0 && inputX === 0 && !keys.current.w)
      if (!backOnly) {
        lookDir.current.copy(lastMoveDir.current)
      }
    }

    // --- XZ-only distance to Sun ---
    const distXZ = Math.hypot(pos.current.x, pos.current.z)

    // --- shitty gravity (XZ) ---
    if (!captured.current && distXZ < GRAVITY_RADIUS) {
      const gravDirXZ = new THREE.Vector3(-pos.current.x, 0, -pos.current.z).normalize()
      const g = 12.0 / Math.max(distXZ * distXZ, 0.36)
      vel.current.addScaledVector(gravDirXZ, g * dtc)
    }

    // --- capture (XZ rim cross) ---
    if (!captured.current && distXZ < CAPTURE_RADIUS) {
      captured.current = true
      onCaptured?.()
      // Freeze camera
      camPos.current.copy(camera.position)
      camQuat.current.copy(camera.quaternion)
      camFrozen.current = true
    }

    // integrate + damp
    vel.current.multiplyScalar(Math.pow(DAMP, dtc * 60))
    if (vel.current.length() > MAX_SPEED) vel.current.setLength(MAX_SPEED)

    if (captured.current) {
      const toSunXZ = new THREE.Vector3(-pos.current.x, 0, -pos.current.z)
      const sideXZ = new THREE.Vector3(-toSunXZ.z, 0, toSunXZ.x).setLength(1)
      vel.current.addScaledVector(toSunXZ.normalize(), 30 * dtc)
      vel.current.addScaledVector(sideXZ, 4 * dtc)
      vel.current.multiplyScalar(0.88)
      if (group.current) {
        const s = Math.max(0.16, group.current.scale.x * (1 - 1.4 * dtc))
        group.current.scale.setScalar(s)
        if (ring.current) ring.current.rotation.z += dtc * 3.0
      }
    }

    pos.current.addScaledVector(vel.current, dtc)
    pos.current.y = -1.0
    if (group.current) group.current.position.copy(pos.current)

    // --- camera: follow or freeze ---
    if (camFrozen.current) {
      camera.position.copy(camPos.current)
      camera.quaternion.copy(camQuat.current)
      camera.updateMatrixWorld()
    } else {
      const separation = distXZ
      const widen = THREE.MathUtils.smoothstep(separation, 0.0, 10.0)
      const camHeight = THREE.MathUtils.lerp(BASE_HEIGHT, MAX_HEIGHT, widen)
      const camBack   = THREE.MathUtils.lerp(BASE_BACK,   MAX_BACK,   widen)

      const idleDir = new THREE.Vector3(pos.current.x, 0, pos.current.z).normalize()
      const moveDir = lookDir.current.lengthSq() > 0 ? lookDir.current.clone().normalize() : idleDir
      const bias = THREE.MathUtils.clamp((GRAVITY_RADIUS - separation) / GRAVITY_RADIUS, 0, 1) * 0.35
      const camFwd = moveDir.clone().multiplyScalar(1 - bias).addScaledVector(idleDir, bias).normalize()

      const lookTarget = pos.current.clone().multiplyScalar(1 - 0.4 * bias)
      const desiredPos = lookTarget.clone().addScaledVector(camFwd, -camBack).addScaledVector(up, camHeight)

      const smooth = 1 - Math.pow(0.0007, dtc)
      camera.position.lerp(desiredPos, smooth)
      camera.lookAt(lookTarget)
    }

    // --- beauty: shimmer/flicker ---
    const flicker = 0.65 + 0.35 * fbm(t * 1.2)
    const twinkle = 0.5 + 0.5 * Math.sin(t * 8.0) * 0.15
    const scale = 1.0 + (flicker - 0.65) * 0.08 + twinkle * 0.04
    if (!captured.current && group.current) group.current.scale.setScalar(scale)

    const hue = 0.095 + 0.015 * Math.sin(t * 0.6)
    const coreColor = new THREE.Color().setHSL(hue, 0.85, 0.65 + 0.1 * flicker)

    if (coreMat.current) { coreMat.current.color.copy(coreColor); coreMat.current.opacity = 0.95 }
    if (haloMat.current) { haloMat.current.opacity = 0.22 + 0.28 * flicker }
    if (auraMat.current) { auraMat.current.opacity = 0.10 + 0.20 * flicker }
    if (ring.current && !captured.current) {
      ring.current.rotation.z += dt * 0.7
      ring.current.rotation.x = Math.sin(t * 0.7) * 0.2
    }
    const light = group.current?.children?.find?.(c => c.isPointLight)
    if (light) {
      light.intensity = 0.9 + 0.7 * flicker
      light.color.set(coreColor)
      light.distance = 6.5 + 1.2 * flicker
    }
  })

  return (
    <group ref={group}>
      {/* Core */}
      <mesh>
        <sphereGeometry args={[0.085, 32, 32]} />
        <meshBasicMaterial ref={coreMat} toneMapped={false} transparent opacity={0.95} color={'#ffe9a6'} />
      </mesh>
      {/* Halo */}
      <mesh>
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshBasicMaterial
          ref={haloMat}
          toneMapped={false}
          transparent
          opacity={0.28}
          color={'#ffdca0'}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Aura */}
      <mesh>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshBasicMaterial
          ref={auraMat}
          toneMapped={false}
          transparent
          opacity={0.16}
          color={'#ffcc7a'}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Ring */}
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.006, 24, 64]} />
        <meshBasicMaterial toneMapped={false} color={'#ffe2a9'} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Painter light */}
      <pointLight intensity={1.1} distance={6.5} color={'#ffdca0'} />
    </group>
  )
}

function AstralWireframes() {
  const group = useRef(null)
  useFrame((_, dt) => { if (group.current) group.current.rotation.y += dt * 0.08 })
  return (
    <group ref={group}>
      <Float speed={0.6} rotationIntensity={0.1} floatIntensity={0.6}>
        <Icosahedron args={[3.6, 0]}>
          <meshBasicMaterial wireframe color={PALETTE.wire} />
        </Icosahedron>
      </Float>
      <Float speed={0.5} rotationIntensity={0.12} floatIntensity={0.5}>
        <Dodecahedron args={[2.5, 0]}>
          <meshBasicMaterial wireframe color={PALETTE.wire} />
        </Dodecahedron>
      </Float>
      <Float speed={0.4} rotationIntensity={0.14} floatIntensity={0.5}>
        <TorusKnot args={[1.3, 0.04, 256, 16, 2, 3]}>
          <meshBasicMaterial wireframe color={PALETTE.wire} />
        </TorusKnot>
      </Float>
    </group>
  )
}

function EnergyRibbons({ count = 6 }) {
  const lines = useMemo(() => {
    const arr = []
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const radius = 6 + Math.random() * 2
      const start = new THREE.Vector3(Math.cos(angle) * radius, (Math.random() - 0.5) * 3.5, Math.sin(angle) * radius)
      const mid = start.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 1.2, 0))
      const end = new THREE.Vector3(0, 0, 0)
      arr.push({ start, mid, end })
    }
    return arr
  }, [count])

  return (
    <group>
      {lines.map((l, i) => (
        <QuadraticBezierLine
          key={i}
          start={l.start}
          end={l.end}
          mid={l.mid}
          color={PALETTE.wire}
          lineWidth={1.4}
          dashed={false}
          transparent
          opacity={0.9}
        />
      ))}
    </group>
  )
}

function Effects({ sunRef }) {
  const sun = sunRef?.current || null
  return (
    <EffectComposer multisampling={4} disableNormalPass>
      <Bloom intensity={1.3} luminanceThreshold={0.12} luminanceSmoothing={0.18} kernelSize={KernelSize.LARGE} mipmapBlur />
      {sun && (
        <GodRays
          sun={sun}
          samples={80}
          density={0.9}
          decay={0.96}
          weight={0.35}
          exposure={0.92}
          clampMax={1.2}
          blur
        />
      )}
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.12} />
      <Vignette eskil={false} offset={0.25} darkness={0.6} />
    </EffectComposer>
  )
}

/* ----------------------------- SOLAR CONSOLE ----------------------------- */

function SolarConsole({ onClose, fullscreen = false, palette, preset, editable = false }) {
  // Build FS from preset (or from localStorage if present)
  const [fsRoot, setFsRoot] = React.useState(() => {
    const saved = safeLoad()
    return saved ?? buildFromPreset(preset ?? DEFAULT_PRESET, palette)
  })
  const [path, setPath] = React.useState([])            // folder path array
  const [selectedPath, setSelectedPath] = React.useState(null) // full path to selected file

  // Current folder node
  const here = React.useMemo(() => getNode(fsRoot, path), [fsRoot, path])
  const selectedNode = React.useMemo(() => (selectedPath ? getNode(fsRoot, selectedPath) : null), [fsRoot, selectedPath])

  // Clear file selection when folder changes
  React.useEffect(() => { setSelectedPath(null) }, [path.join('/')])

  const isFull = fullscreen
  const wrapperStyle = isFull
    ? {
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        background: 'radial-gradient(1200px 800px at 50% 40%, rgba(255,204,122,0.12), rgba(10,6,3,0.98) 60%)',
        color: '#ffcc7a', zIndex: 20, backdropFilter: 'blur(4px)'
      }
    : {
        position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
        width: '90%', maxWidth: 860, background: 'rgba(10,6,3,0.95)', color: '#ffcc7a',
        border: '2px solid #ffcc7a', borderRadius: 16, boxShadow: '0 0 20px rgba(255,204,122,0.6)',
        zIndex: 12, display: 'flex', flexDirection: 'column'
      }

  // Save FS to localStorage
  const persist = (next) => {
    setFsRoot(next)
    try { localStorage.setItem('solarFS', JSON.stringify(next)) } catch {}
  }

  // Edit handler: update a file’s content by path
  const handleSaveFile = (newText) => {
    if (!selectedPath) return
    const next = setFileContentAtPath(fsRoot, selectedPath, newText)
    persist(next)
  }

  return (
    <div role="dialog" aria-label="Solar Console" style={wrapperStyle} onClick={(e)=>e.stopPropagation()}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: '1px solid rgba(255,204,122,0.25)'}}>
        <strong style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }}>☉ SOLAR /shell</strong>
        <Breadcrumbs path={path} onJump={(i)=> setPath(path.slice(0, i))} />
        <div style={{ marginLeft: 'auto', display:'flex', gap:8 }}>
          <button onClick={()=> setPath(p => p.slice(0, -1))} disabled={path.length===0}
                  style={btnStyle(path.length===0)}>Up</button>
          <button onClick={onClose} style={btnPrimaryStyle}>Close</button>
        </div>
      </div>

      {/* Body: left (explorer) + right (viewer) */}
      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', minHeight: isFull ? 'calc(100vh - 64px)' : 420 }}>
        {/* Explorer */}
        <div style={{ borderRight:'1px solid rgba(255,204,122,0.25)', padding:12, overflow:'auto' }}>
          <FolderList
            node={here}
            onOpenFolder={(name)=> setPath(p => [...p, name])}
            onOpenFile={(name)=> setSelectedPath([...path, name])}
          />
        </div>

        {/* Viewer */}
        <div style={{ padding:16, overflow:'auto' }}>
          {selectedNode ? (
            <FileViewer
              node={selectedNode}
              editable={editable}
              onSave={handleSaveFile}
            />
          ) : (
            <EmptyHint />
          )}
        </div>
      </div>
    </div>
  )
}

function AudioManager({ introUrl, loopUrl, startOnCapture = false, volume = 0.7, crossfadeSec = 2.0 }) {
  const [started, setStarted] = React.useState(false)
  const hasStarted = React.useRef(false)   // survives re-renders, no stale closure
  const isStarting = React.useRef(false)   // re-entrancy lock
  const [muted, setMuted] = React.useState(false)
  

  const ctxRef = React.useRef(null)
  const masterGain = React.useRef(null)
  const introGain = React.useRef(null)
  const loopGain = React.useRef(null)
  const introSrc = React.useRef(null)
  const loopSrc = React.useRef(null)
  const introBuf = React.useRef(null)
  const loopBuf = React.useRef(null)

  const alreadyStarted = () => hasStarted.current || isStarting.current
  // helper: decode with promise on Safari too
  const decode = (ctx, ab) =>
    new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej))

  const ensureContext = async () => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      ctxRef.current = new AudioCtx()
      masterGain.current = ctxRef.current.createGain()
      introGain.current = ctxRef.current.createGain()
      loopGain.current = ctxRef.current.createGain()
      // chain: intro/loop -> master -> destination
      introGain.current.connect(masterGain.current)
      loopGain.current.connect(masterGain.current)
      masterGain.current.connect(ctxRef.current.destination)
      masterGain.current.gain.setValueAtTime(volume, ctxRef.current.currentTime)
      introGain.current.gain.setValueAtTime(1, ctxRef.current.currentTime)
      loopGain.current.gain.setValueAtTime(0, ctxRef.current.currentTime)
    }
    if (ctxRef.current.state === 'suspended') await ctxRef.current.resume()
  }

  const loadIfNeeded = async () => {
    if (!introBuf.current) {
      const [a, b] = await Promise.all([
        fetch(introUrl).then(r => r.arrayBuffer()),
        fetch(loopUrl).then(r => r.arrayBuffer())
      ])
      introBuf.current = await decode(ctxRef.current, a)
      loopBuf.current = await decode(ctxRef.current, b)
    }
  }

  const startAudio = async () => {
    if (alreadyStarted()) return
    isStarting.current = true
    await ensureContext()
    await loadIfNeeded()
    const ctx = ctxRef.current

    // Create sources
    introSrc.current = ctx.createBufferSource()
    loopSrc.current = ctx.createBufferSource()
    introSrc.current.buffer = introBuf.current
    loopSrc.current.buffer = loopBuf.current
    loopSrc.current.loop = true

    // Connect
    introSrc.current.connect(introGain.current)
    loopSrc.current.connect(loopGain.current)

    // Times
    const now = ctx.currentTime + 0.05
    const introDur = introBuf.current.duration
    const xfade = Math.min(crossfadeSec, Math.max(0.2, introDur * 0.5)) // cap to half intro

    // Start intro now
    introSrc.current.start(now)

    // Start loop slightly before intro ends, ramp gains for crossfade
    const loopStart = now + Math.max(0, introDur - xfade)
    loopSrc.current.start(loopStart)

    // Crossfade
    loopGain.current.gain.setValueAtTime(0, loopStart)
    loopGain.current.gain.linearRampToValueAtTime(1, loopStart + xfade)
    introGain.current.gain.setValueAtTime(1, loopStart)
    introGain.current.gain.linearRampToValueAtTime(0, loopStart + xfade)

    // Cleanup when intro finishes (optional)
    introSrc.current.onended = () => {
      try { introSrc.current.disconnect() } catch {}
      introSrc.current = null
    }

    hasStarted.current = true
    setStarted(true)
    isStarting.current = false
  }

  // Allow manual start via UI
  const handleEnable = async () => {
    if (alreadyStarted()) return
    try { await startAudio() } catch {}
  }

  // Auto-start when captured if not started yet
  React.useEffect(() => {
    if (startOnCapture && !hasStarted.current) handleEnable()
  }, [startOnCapture]) // eslint-disable-line

  // Also allow first interaction to kick it off (autoplay-safe)
  React.useEffect(() => {
    if (hasStarted.current) return
    const onKey  = () => { if (!hasStarted.current) handleEnable() }
    window.addEventListener('keydown', onKey, { once: true })
    return () => {
      window.removeEventListener('keydown', onKey, { once: true })
    }
  }, [started])

  // Volume & mute
  React.useEffect(() => {
    if (!masterGain.current || !ctxRef.current) return
    const t = ctxRef.current.currentTime
    const target = muted ? 0 : volume
    masterGain.current.gain.cancelScheduledValues(t)
    masterGain.current.gain.linearRampToValueAtTime(target, t + 0.08)
  }, [muted, volume])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      try { introSrc.current?.stop() } catch {}
      try { loopSrc.current?.stop() } catch {}
      try { ctxRef.current?.close() } catch {}
    }
  }, [])

  // UI (tiny pill controls)
  return (
    <div style={{ position:'absolute', right:12, bottom:12, display:'flex', gap:8, zIndex:30 }}>
      {started && (
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          background:'rgba(10,6,3,0.85)', border:'1px solid rgba(255,204,122,0.35)',
          color:'#ffcc7a', borderRadius:999, padding:'6px 10px'
        }}>
          <button
            onClick={() => setMuted(m => !m)}
            style={{ background:'transparent', border:'none', color:'#ffcc7a', cursor:'pointer', fontSize:14 }}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <input
            type="range"
            min={0} max={1} step={0.01}
            defaultValue={volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              // immediate update without re-render churn
              if (masterGain.current && ctxRef.current) {
                const t = ctxRef.current.currentTime
                masterGain.current.gain.cancelScheduledValues(t)
                masterGain.current.gain.linearRampToValueAtTime(muted ? 0 : v, t + 0.05)
              }
            }}
            style={{ accentColor:'#ffcc7a' }}
          />
        </div>
      )}
    </div>
  )
}

function Keycap({ children }) {
  return (
    <div
      style={{
        width: 26, height: 26, borderRadius: 6,
        display: 'grid', placeItems: 'center',
        border: '1px solid rgba(255,204,122,0.35)',
        background: 'rgba(255,204,122,0.12)',
        fontFamily: 'monospace', fontWeight: 700, fontSize: 12,
        color: '#ffcc7a'
      }}
    >
      {children}
    </div>
  )
}

function WasdHint({ palette, hidden = false }) {
  if (hidden) return null
  return (
    <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 24 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px',
          color: palette?.wire ?? '#ffcc7a',
          background: 'rgba(10,6,3,0.85)',
          border: '1px solid rgba(255,204,122,0.35)',
          borderRadius: 12,
          boxShadow: '0 0 12px rgba(255,204,122,0.25)',
          fontFamily: 'monospace'
        }}
      >
        {/* Key layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '26px 26px 26px', gridAutoRows: '26px', gap: 4 }}>
          <div />             {/* empty */}
          <Keycap>W</Keycap>  {/* top middle */}
          <div />             {/* empty */}
          <Keycap>A</Keycap>
          <Keycap>S</Keycap>
          <Keycap>D</Keycap>
        </div>

        {/* Label */}
        <div style={{ fontSize: 12, lineHeight: 1.2, opacity: 0.9 }}>
          <div><strong>WASD</strong> to move</div>
          <div style={{ opacity: 0.8 }}>camera-relative</div>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------- FS helpers ----------------------------- */

function buildFromPreset(preset, palette) {
  const rootObj = preset?.["/"] ?? {}
  return folder('/', Object.entries(rootObj).map(([name, val]) => nodeFromEntry(name, val, palette)))
}

function nodeFromEntry(name, val, palette) {
  if (typeof val === 'string') {
    return file(name, injectTokens(val, palette))
  } else if (val && typeof val === 'object') {
    return folder(name, Object.entries(val).map(([n, v]) => nodeFromEntry(n, v, palette)))
  } else {
    return file(name, '')
  }
}

function injectTokens(text, palette) {
  if (typeof text !== 'string') return text
  if (text.includes('{{PALETTE_JSON}}')) {
    try { text = text.replaceAll('{{PALETTE_JSON}}', JSON.stringify(palette, null, 2)) } catch {}
  }
  return text
}

function folder(name, children = []) { return { type:'folder', name, children } }
function file(name, content) { return { type:'file', name, content } }

function getNode(root, pathArr) {
  let cur = root
  for (const seg of pathArr) {
    if (!cur || cur.type !== 'folder') return null
    cur = cur.children.find(c => c.name === seg)
  }
  return cur || null
}

function setFileContentAtPath(root, pathArr, newText) {
  // pathArr = ['folderA','sub','file.txt']
  const rec = (node, depth = 0) => {
    if (!node) return node
    if (depth === pathArr.length) return node
    if (node.type === 'folder') {
      const name = pathArr[depth]
      const nextKids = node.children.map(ch => {
        if (ch.name !== name) return ch
        if (depth === pathArr.length - 1) {
          // this is the file
          if (ch.type !== 'file') return ch
          return { ...ch, content: newText }
        }
        return rec(ch, depth + 1)
      })
      return { ...node, children: nextKids }
    }
    return node
  }
  return rec(root, 0)
}

function safeLoad() {
  try {
    const raw = localStorage.getItem('solarFS')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/* ----------------------------- UI bits ----------------------------- */

function FolderList({ node, onOpenFolder, onOpenFile }) {
  if (!node || node.type !== 'folder') return null
  const items = [...node.children]
  items.sort((a,b) => (a.type===b.type ? a.name.localeCompare(b.name) : a.type==='folder' ? -1 : 1))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {items.map((n) => (
        <div
          key={n.name}
          role="button"
          onClick={() => n.type==='folder' ? onOpenFolder(n.name) : onOpenFile(n.name)}
          style={{
            display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8,
            cursor:'pointer', background:'rgba(26,18,13,0.7)', border:'1px solid rgba(255,204,122,0.15)'
          }}
        >
          <span style={{ width:18, display:'inline-block', textAlign:'center' }}>
            {n.type==='folder' ? '📁' : iconFor(n.name)}
          </span>
          <span style={{ fontFamily:'monospace' }}>{n.name}</span>
        </div>
      ))}
      {items.length===0 && <div style={{ opacity:0.6, fontFamily:'monospace' }}>(empty)</div>}
    </div>
  )
}

function iconFor(name) {
  const ext = name.split('.').pop().toLowerCase()
  if (ext === 'md') return '📝'
  if (ext === 'json') return '🧾'
  if (ext === 'log' || ext === 'txt') return '📄'
  return '📄'
}

function Breadcrumbs({ path, onJump }) {
  const full = ['root', ...path]
  return (
    <div style={{ fontFamily:'monospace', fontSize:12, opacity:0.9 }}>
      {full.map((seg, i) => (
        <span key={i}>
          <a onClick={() => onJump(i)} style={{ cursor:'pointer', textDecoration:'underline', color:'#ffcc7a' }}>
            {seg}
          </a>
          {i < full.length - 1 ? ' / ' : ''}
        </span>
      ))}
    </div>
  )
}

function FileViewer({ node, editable, onSave }) {
  if (!node || node.type !== 'file') return null
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(node.content ?? '')

  // keep editor in sync when you select a different file
  React.useEffect(() => { setEditing(false); setText(node.content ?? '') }, [node?.name])

  const mono = { fontFamily:'ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }
  const isJSON = node.name.toLowerCase().endsWith('.json')

  const pretty = (t) => {
    if (!isJSON) return t
    try { return JSON.stringify(JSON.parse(t), null, 2) } catch { return t }
  }

  return (
    <div style={{
      background:'rgba(26,18,13,0.85)',
      border:'1px solid rgba(255,204,122,0.25)',
      borderRadius:12, padding:12, minHeight:280, display:'flex', flexDirection:'column', gap:8
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ ...mono, fontWeight:700, letterSpacing:'0.04em' }}>{node.name}</div>
        <div style={{ display:'flex', gap:8 }}>
          {editable && !editing && <button onClick={() => setEditing(true)} style={btnStyle(false)}>Edit</button>}
          {editable && editing && (
            <>
              <button onClick={() => { onSave?.(text); setEditing(false) }} style={btnPrimaryStyle}>Save</button>
              <button onClick={() => { setText(node.content ?? ''); setEditing(false) }} style={btnStyle(false)}>Cancel</button>
            </>
          )}
          {!editing && <button onClick={() => copyToClipboard(node.content ?? '')} style={btnStyle(false)}>Copy</button>}
        </div>
      </div>

      {!editing ? (
        <pre style={{ ...mono, margin:0, whiteSpace:'pre-wrap', lineHeight:1.4, opacity:0.95 }}>
          {pretty(node.content ?? '')}
        </pre>
      ) : (
        <textarea
          value={text}
          onChange={(e)=> setText(e.target.value)}
          style={{ ...mono, width:'100%', minHeight:260, resize:'vertical', background:'rgba(0,0,0,0.25)', color:'#ffcc7a', border:'1px solid rgba(255,204,122,0.25)', borderRadius:8, padding:10 }}
        />
      )}
    </div>
  )
}

function EmptyHint() {
  return (
    <div style={{
      height:'100%', display:'grid', placeItems:'center',
      color:'#ffcc7a', opacity:0.8, fontFamily:'monospace', textAlign:'center'
    }}>
      <div>
        <div style={{ marginBottom:8 }}>Select a file on the left to open it.</div>
        <div style={{ fontSize:12, opacity:0.75 }}>tip: try <em>solar/plaque.md</em> or <em>history/…</em></div>
      </div>
    </div>
  )
}

function copyToClipboard(text) {
  try { navigator.clipboard?.writeText(text) } catch {}
}

/* ----------------------------- buttons ----------------------------- */

const btnStyle = (disabled=false) => ({
  padding:'6px 10px', background: disabled ? 'rgba(255,204,122,0.25)' : 'rgba(255,204,122,0.15)',
  border:'1px solid rgba(255,204,122,0.35)', color:'#ffcc7a', borderRadius:8, cursor: disabled ? 'not-allowed':'pointer'
})

const btnPrimaryStyle = {
  padding:'6px 10px', background:'#ffcc7a', color:'#0a0603', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer'
}