// Web Audio API를 사용한 MIDI 피아노 소리 생성
class MidiSound {
  private audioContext: AudioContext | null = null
  
  // MIDI 노트 번호 (C4 = 60을 기준으로)
  // C4, D4, E4, F4, G4, A4, B4, C5
  private notes = [60, 62, 64, 65, 67, 69, 71, 72]

  private init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
  }

  /**
   * MIDI 노트 번호를 주파수로 변환
   * @param note MIDI 노트 번호 (0-127)
   * @returns 주파수 (Hz)
   */
  private midiToFrequency(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12)
  }

  /**
   * MIDI 피아노 소리 재생
   * @param noteIndex 음계 인덱스 (0-7, 높을수록 높은 음)
   * @param velocity 충돌 속도 (음량 조절용, 0-1)
   */
  play(noteIndex: number, velocity: number = 0.5) {
    this.init()
    if (!this.audioContext) return

    const now = this.audioContext.currentTime
    
    // 음계 인덱스를 0-7 범위로 제한
    const clampedIndex = Math.max(0, Math.min(7, Math.floor(noteIndex)))
    const midiNote = this.notes[clampedIndex]
    const frequency = this.midiToFrequency(midiNote)

    // 음량 (충돌 속도에 비례)
    const volume = Math.min(0.5, Math.max(0.05, velocity * 0.5))

    // 피아노 소리를 위한 여러 오실레이터 조합
    const oscillators: OscillatorNode[] = []
    const gains: GainNode[] = []

    // 기본음 (sine wave로 부드러운 피아노 소리)
    const osc1 = this.audioContext.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.value = frequency

    // 배음들 (피아노의 풍부한 음색을 위해)
    const osc2 = this.audioContext.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = frequency * 2

    const osc3 = this.audioContext.createOscillator()
    osc3.type = 'sine'
    osc3.frequency.value = frequency * 3

    const osc4 = this.audioContext.createOscillator()
    osc4.type = 'triangle' // 약간의 풍부함을 위해
    osc4.frequency.value = frequency * 4

    oscillators.push(osc1, osc2, osc3, osc4)

    // 각 오실레이터에 대한 게인 노드
    const gain1 = this.audioContext.createGain()
    const gain2 = this.audioContext.createGain()
    const gain3 = this.audioContext.createGain()
    const gain4 = this.audioContext.createGain()

    gains.push(gain1, gain2, gain3, gain4)

    // 배음 비율 (피아노 음색)
    gain1.gain.value = volume
    gain2.gain.value = volume * 0.4
    gain3.gain.value = volume * 0.2
    gain4.gain.value = volume * 0.1

    // 마스터 게인
    const masterGain = this.audioContext.createGain()

    // 피아노 ADSR 엔벨로프
    const attackTime = 0.005 // 빠른 어택
    const decayTime = 0.1
    const sustainTime = 0.2
    const sustainLevel = 0.6
    const releaseTime = 0.3

    masterGain.gain.setValueAtTime(0, now)
    masterGain.gain.linearRampToValueAtTime(1, now + attackTime)
    masterGain.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime)
    masterGain.gain.setValueAtTime(sustainLevel, now + attackTime + decayTime + sustainTime)
    masterGain.gain.linearRampToValueAtTime(0, now + attackTime + decayTime + sustainTime + releaseTime)

    // 연결
    osc1.connect(gain1)
    osc2.connect(gain2)
    osc3.connect(gain3)
    osc4.connect(gain4)
    
    gain1.connect(masterGain)
    gain2.connect(masterGain)
    gain3.connect(masterGain)
    gain4.connect(masterGain)
    
    masterGain.connect(this.audioContext.destination)

    // 재생
    const duration = attackTime + decayTime + sustainTime + releaseTime
    oscillators.forEach(osc => {
      osc.start(now)
      osc.stop(now + duration)
    })
  }

  /**
   * 화음 재생 (여러 음을 동시에)
   * @param noteIndices 음계 인덱스 배열
   * @param velocity 충돌 속도
   */
  playChord(noteIndices: number[], velocity: number = 0.5) {
    noteIndices.forEach(index => {
      this.play(index, velocity)
    })
  }

  /**
   * AudioContext 정리
   */
  dispose() {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}

// 싱글톤 인스턴스
export const midiSound = new MidiSound()

