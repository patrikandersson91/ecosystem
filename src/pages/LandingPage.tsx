import { useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { useEcosystemDispatch } from '../state/ecosystem-context.tsx'

export default function LandingPage() {
  const dispatch = useEcosystemDispatch()
  const navigate = useNavigate()

  const [rabbits, setRabbits] = useState(30)
  const [foxes, setFoxes] = useState(8)
  const [moose, setMoose] = useState(3)
  const [flowers, setFlowers] = useState(80)

  function handleStart() {
    dispatch({
      type: 'INIT',
      config: { initialRabbits: rabbits, initialFoxes: foxes, initialMoose: moose, initialFlowers: flowers },
    })
    navigate('/sim')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-950 via-green-900 to-teal-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md rounded-2xl bg-black/40 p-8 backdrop-blur-md"
      >
        <h1 className="mb-2 text-4xl font-bold text-white">Ecosystem</h1>
        <p className="mb-8 text-sm text-emerald-300/70">
          Configure your simulation and watch nature unfold.
        </p>

        <div className="space-y-6">
          <SliderField
            label="Rabbits"
            value={rabbits}
            onChange={setRabbits}
            min={1}
            max={40}
            color="text-amber-300"
          />
          <SliderField
            label="Foxes"
            value={foxes}
            onChange={setFoxes}
            min={1}
            max={15}
            color="text-orange-400"
          />
          <SliderField
            label="Moose"
            value={moose}
            onChange={setMoose}
            min={0}
            max={12}
            color="text-yellow-200"
          />
          <SliderField
            label="Flowers"
            value={flowers}
            onChange={setFlowers}
            min={10}
            max={120}
            color="text-pink-300"
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStart}
          className="mt-8 w-full cursor-pointer rounded-xl bg-emerald-600 py-3 text-lg font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          Start Simulation
        </motion.button>
      </motion.div>
    </div>
  )
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  color,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  color: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className={`text-sm font-medium ${color}`}>{label}</span>
        <span className="text-sm text-white/60">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500"
      />
    </div>
  )
}
