import { useState, useRef, useMemo } from 'react'
import {
  Video,
  Image as ImageIcon,
  Bot,
  ShoppingCart,
  User,
  MapPin,
  Sparkles,
  Copy,
  Check,
  Plus,
  X,
  Layers,
  Wand2,
  RefreshCw,
  Clock,
  Store,
  Upload
} from 'lucide-react'
import AppShell from '../components/layout/AppShell'
import { MARKETING_PROMPTS, type MarketingPromptItem } from '../data/marketingPrompts'
import './marketingStudio.css'

type StudioTab = 'video' | 'image' | 'agent'

interface ReferenceItem {
  id: string
  type: 'product' | 'avatar' | 'scene'
  name: string
  url: string
}

// Preset samples for fast testing if user doesn't have an image ready
const SAMPLE_PRODUCTS = [
  { id: 'p1', name: 'ขวดเซรั่มบำรุงผิว (Serum)', url: '/image-styles/domestic-suspense-cold.jpg' },
  { id: 'p2', name: 'เครื่องดื่มสกัดเย็น (Drink)', url: '/image-styles/90s-realistic-film.jpg' },
  { id: 'p3', name: 'กล่องของขวัญพรีเมียม (Gift Box)', url: '/image-styles/korean-urban-soft.jpg' },
]

const SAMPLE_AVATARS = [
  { id: 'a1', name: 'นางแบบสไตล์ไทย (Thai UGC Model)', url: '/char-presets/real.jpg' },
  { id: 'a2', name: 'ครีเอเตอร์สายเทค (Tech Reviewer)', url: '/char-presets/sil.jpg' },
  { id: 'a3', name: 'สไตล์อนิเมะพรีเซนเตอร์ (Anime Avatar)', url: '/char-presets/anime.jpg' },
]

const SAMPLE_SCENES = [
  { id: 's1', name: 'คาเฟ่สไตล์โมเดิร์น (Cozy Cafe)', url: '/image-styles/japanese-daily-natural.jpg' },
  { id: 's2', name: 'สตรีทฟู้ดยามค่ำคืน (Street Food Night)', url: '/image-styles/neon-cyberpunk-film.jpg' },
  { id: 's3', name: 'สตูดิโอมินิมอล (Clean Studio)', url: '/image-styles/chinese-urban-realistic.jpg' },
]

const FEATURE_PRESETS = [
  {
    id: 'f1',
    title: 'เครื่องมือถอดแบบวิดีโอ',
    desc: 'สร้างโฆษณาที่สะดุดตา',
    icon: Wand2,
    bg: '/image-styles/90s-realistic-film.jpg',
    promptTemplate: '10 วินาที, 9:16, ถอดแบบสไตล์วิดีโอโฆษณาไวรัล TikTok แสงสว่างสดใส สลับมุมกล้องฉับไว'
  },
  {
    id: 'f2',
    title: 'สลับสินค้า',
    desc: 'ปรับโฉมสินค้าใหม่',
    icon: RefreshCw,
    bg: '/image-styles/domestic-suspense-cold.jpg',
    promptTemplate: 'เปลี่ยนสินค้าในมือนางแบบให้กลายเป็น Reference 2 อย่างแนบเนียน แสงเงาตรงกับสภาพแวดล้อม'
  },
  {
    id: 'f3',
    title: 'การถ่ายภาพสินค้า',
    desc: 'นำเสนอสินค้าอย่างมีสไตล์',
    icon: ImageIcon,
    bg: '/image-styles/chinese-urban-realistic.jpg',
    promptTemplate: 'ภาพนิ่งเชิงพาณิชย์ระดับ 8K จัดวาง Reference 2 คู่กับ Reference 3 แสงสตูดิโอสวยหรู'
  },
  {
    id: 'f4',
    title: 'โฆษณาสินค้า',
    desc: 'เปลี่ยนสินค้าเป็นโฆษณา',
    icon: Sparkles,
    bg: '/image-styles/korean-urban-soft.jpg',
    promptTemplate: '15 วินาที, 9:16, โฆษณาเปิดตัวสินค้าใหม่ ดนตรีจังหวะเร้าใจ แสดงประสิทธิภาพของสินค้าอย่างคมชัด'
  },
  {
    id: 'f5',
    title: 'จัดเฟรมวิดีโอ',
    desc: 'ปรับวิดีโอให้พอดีกับทุกขนาด',
    icon: Layers,
    bg: '/image-styles/japanese-youth-film.jpg',
    promptTemplate: 'ปรับอัตราส่วนภาพให้เหมาะกับแนวตั้ง 9:16 พร้อมขยายพื้นหลังอย่างเป็นธรรมชาติ'
  },
  {
    id: 'f6',
    title: 'ปรับบริบทสินค้า',
    desc: 'พาเนื้อหาไปสู่สายตาผู้บริโภค',
    icon: Store,
    bg: '/image-styles/japanese-daily-natural.jpg',
    promptTemplate: 'จัดฉากให้ Reference 2 อยู่ในบรรยากาศคาเฟ่สบายๆ มีผู้คนกำลังใช้ชีวิตอย่างมีความสุขในฉากหลัง'
  }
]

export default function MarketingStudioPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>('video')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('Dreamina Seedance 2.5')
  const [stylePreset, setStylePreset] = useState('สมจริงภาพยนตร์')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [resolution, setResolution] = useState('720P')
  const [duration, setDuration] = useState('10 วินาที')
  
  // References: Product, Avatar, Scene
  const [productRef, setProductRef] = useState<ReferenceItem | null>(null)
  const [avatarRef, setAvatarRef] = useState<ReferenceItem | null>(null)
  const [sceneRef, setSceneRef] = useState<ReferenceItem | null>(null)

  // Modals for selecting presets or uploading
  const [pickerType, setPickerType] = useState<'product' | 'avatar' | 'scene' | null>(null)

  // Prompts filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Generation Simulator State
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generatedOutput, setGeneratedOutput] = useState<{
    type: 'video' | 'image'
    url: string
    prompt: string
    model: string
    time: string
  } | null>(null)

  const composerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filtered GitHub Prompts
  const filteredPrompts = useMemo(() => {
    return MARKETING_PROMPTS.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory
      const matchSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.titleEn && item.titleEn.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchCat && matchSearch
    })
  }, [selectedCategory, searchQuery])

  // Handle Load Prompt into Studio
  const handleUsePrompt = (item: MarketingPromptItem) => {
    setPrompt(item.prompt)
    if (item.aspectRatio) setAspectRatio(item.aspectRatio)
    if (item.duration) setDuration(item.duration.replace('s', ' วินาที'))
    if (item.mode.includes('I2V') || item.mode.includes('T2V') || item.mode.includes('R2V')) {
      setActiveTab('video')
    }
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // Handle Copy Prompt
  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Handle Tag Append to Prompt
  const handleAddTag = (tagText: string) => {
    setPrompt((prev) => (prev ? `${prev} ${tagText}` : tagText))
  }

  // Handle Local File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pickerType) return
    const url = URL.createObjectURL(file)
    const item: ReferenceItem = {
      id: `upload_${Date.now()}`,
      type: pickerType,
      name: file.name,
      url: url,
    }
    if (pickerType === 'product') setProductRef(item)
    else if (pickerType === 'avatar') setAvatarRef(item)
    else if (pickerType === 'scene') setSceneRef(item)
    setPickerType(null)
  }

  // Handle Trigger Generate
  const handleGenerate = () => {
    if (!prompt.trim() && !productRef && !avatarRef) {
      alert('กรุณาใส่ Prompt หรือเลือกรูปอ้างอิงสินค้า/อวตารก่อนสร้าง')
      return
    }
    setIsGenerating(true)
    setGenerationProgress(15)
    
    const interval = setInterval(() => {
      setGenerationProgress((p) => {
        if (p >= 95) {
          clearInterval(interval)
          return 95
        }
        return p + 20
      })
    }, 600)

    setTimeout(() => {
      clearInterval(interval)
      setIsGenerating(false)
      setGenerationProgress(100)
      setGeneratedOutput({
        type: activeTab === 'image' ? 'image' : 'video',
        url: activeTab === 'image' 
          ? (productRef?.url || '/image-styles/chinese-urban-realistic.jpg') 
          : '/hero.jpg',
        prompt: prompt || 'โฆษณา AI UGC รีวิวสินค้าสร้างสรรค์',
        model: model,
        time: new Date().toLocaleTimeString(),
      })
    }, 3200)
  }

  return (
    <AppShell active="home" hideFooter>
      <div className="mkt-page">
        <div className="mkt-bg-ambient" />

        <div className="mkt-container">
          {/* 1. Hero Showcase Top Banners (Dreamina Style) */}
          <section className="mkt-hero">
            <div className="mkt-hero-cards">
              <div className="mkt-hero-banner">
                <img src="/image-styles/90s-realistic-film.jpg" alt="E-Commerce Fresh" />
                <span className="mkt-hero-banner-tag">🍓 สินค้า & สดชื่น</span>
              </div>
              <div className="mkt-hero-banner featured">
                <img src="/image-styles/korean-urban-soft.jpg" alt="Commercial Creation" />
                <span className="mkt-hero-banner-tag">✨ โฆษณาสตูดิโอ 4K</span>
              </div>
              <div className="mkt-hero-banner">
                <img src="/image-styles/japanese-daily-natural.jpg" alt="UGC Lifestyle" />
                <span className="mkt-hero-banner-tag">☕ รีวิวคาเฟ่ & ท่องเที่ยว</span>
              </div>
            </div>

            <h1 className="mkt-hero-title">สร้างผลงานให้ปังด้วยสตูดิโอการตลาด</h1>
            <p className="mkt-hero-sub">
              <span>AI E-Commerce & UGC Video Studio</span>
              <span className="mkt-hero-badge">Wan 3.0 Commercial · Dreamina Seedance 2.5</span>
            </p>
          </section>

          {/* 2. Main Generation Box (Exact Dreamina Layout) */}
          <div className="mkt-box" ref={composerRef}>
            {/* Top Tabs */}
            <div className="mkt-tabs">
              <button
                className={`mkt-tab-btn ${activeTab === 'video' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('video')
                  if (model.includes('Seedream')) setModel('Dreamina Seedance 2.5')
                }}
              >
                <Video size={16} /> วิดีโอ AI
              </button>
              <button
                className={`mkt-tab-btn ${activeTab === 'image' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('image')
                  setModel('Seedream 5.0 Pro')
                }}
              >
                <ImageIcon size={16} /> รูปภาพ AI
              </button>
              <button
                className={`mkt-tab-btn ${activeTab === 'agent' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('agent')
                  setModel('Wan 3.0 Dialogue & LipSync')
                }}
              >
                <Bot size={16} /> เอเจนต์ AI
              </button>
            </div>

            {/* Input Row: Left References + Center Prompt */}
            <div className="mkt-input-row">
              {/* Left Reference Slots */}
              <div className="mkt-ref-col">
                {/* Product Slot */}
                <div
                  className={`mkt-ref-slot ${productRef ? 'has-image' : ''}`}
                  onClick={() => !productRef && setPickerType('product')}
                  title="ใส่รูปสินค้า (Reference 2)"
                >
                  {productRef ? (
                    <>
                      <img src={productRef.url} alt={productRef.name} />
                      <span className="mkt-ref-badge">{productRef.name}</span>
                      <button
                        className="mkt-ref-remove"
                        onClick={(e) => {
                          e.stopPropagation()
                          setProductRef(null)
                        }}
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={22} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>สินค้า</span>
                    </>
                  )}
                </div>

                {/* Avatar Slot */}
                <div
                  className={`mkt-ref-slot ${avatarRef ? 'has-image' : ''}`}
                  onClick={() => !avatarRef && setPickerType('avatar')}
                  title="ใส่รูปนางแบบ / อวตาร (Reference 1)"
                >
                  {avatarRef ? (
                    <>
                      <img src={avatarRef.url} alt={avatarRef.name} />
                      <span className="mkt-ref-badge">{avatarRef.name}</span>
                      <button
                        className="mkt-ref-remove"
                        onClick={(e) => {
                          e.stopPropagation()
                          setAvatarRef(null)
                        }}
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <>
                      <User size={22} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>อวตาร</span>
                    </>
                  )}
                </div>

                {/* Optional Scene Slot */}
                <div
                  className={`mkt-ref-slot ${sceneRef ? 'has-image' : ''}`}
                  onClick={() => !sceneRef && setPickerType('scene')}
                  title="ใส่รูปฉาก / ร้านอาหาร / สถานที่ท่องเที่ยว (Reference 3)"
                >
                  {sceneRef ? (
                    <>
                      <img src={sceneRef.url} alt={sceneRef.name} />
                      <span className="mkt-ref-badge">{sceneRef.name}</span>
                      <button
                        className="mkt-ref-remove"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSceneRef(null)
                        }}
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <>
                      <MapPin size={22} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>สถานที่</span>
                    </>
                  )}
                </div>
              </div>

              {/* Center Prompt Area */}
              <div className="mkt-prompt-col">
                <textarea
                  className="mkt-textarea"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    activeTab === 'video'
                      ? 'อธิบายวิดีโอของคุณ ตัวอย่าง: อวตารของฉันแกะกล่องสินค้าและโชว์สินค้าใน 15 วินาที พร้อมพูดรีวิวภาษาไทยอย่างเป็นธรรมชาติ...'
                      : activeTab === 'image'
                      ? 'อธิบายรูปภาพของคุณ ตัวอย่าง: อวตารของฉันถือสินค้าอยู่ในคาเฟ่ที่สว่างและดูทันสมัย นั่งทานอาหารอย่างมีความสุข...'
                      : 'กำหนดสคริปต์บทพูดและบุคลิกของอินฟลูเอนเซอร์ ตัวอย่าง: สวัสดีค่ะทุกคน วันนี้พามาชิมร้านลับย่านเยาวราช อร่อยมาก...'
                  }
                  rows={4}
                />

                {/* Directing Structure Prompt Helper Chips */}
                <div className="mkt-prompt-tags">
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>ตัวช่วยแท็กโครงสร้าง:</span>
                  <button className="mkt-prompt-tag-btn" onClick={() => handleAddTag('[ตัวแบบ]: อวตาร Reference 1 ยิ้มสดใส')}>
                    + [ตัวแบบ]
                  </button>
                  <button className="mkt-prompt-tag-btn" onClick={() => handleAddTag('[สินค้า]: ถือ Reference 2 หันฉลากหากล้อง')}>
                    + [สินค้า]
                  </button>
                  <button className="mkt-prompt-tag-btn" onClick={() => handleAddTag('[สถานที่]: นั่งทานอาหารในร้าน Reference 3')}>
                    + [สถานที่]
                  </button>
                  <button className="mkt-prompt-tag-btn" onClick={() => handleAddTag('[การกระทำ]: ยกช้อนตักทาน แล้วพยักหน้าชูนิ้วโป้ง')}>
                    + [การกระทำ]
                  </button>
                  <button className="mkt-prompt-tag-btn" onClick={() => handleAddTag('[กล้อง]: Medium Shot แล้วค่อยๆ Zoom In')}>
                    + [กล้อง]
                  </button>
                  <button className="mkt-prompt-tag-btn" onClick={() => handleAddTag('[บทพูดไทย]: "อร่อยแสงออกปาก แนะนำเลยค่ะ!"')}>
                    + [บทพูดไทย]
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Toolbar */}
            <div className="mkt-toolbar">
              <div className="mkt-toolbar-left">
                <button
                  className="mkt-select-btn"
                  onClick={() => setPickerType('product')}
                  title="เพิ่มรูปภาพอ้างอิง"
                >
                  <Plus size={16} />
                </button>

                {/* Model Selector */}
                <div className="mkt-select-btn">
                  <Sparkles size={14} color="#00f0ff" />
                  <select value={model} onChange={(e) => setModel(e.target.value)}>
                    <option value="Dreamina Seedance 2.5">Dreamina Seedance 2.5</option>
                    <option value="Wan 3.0 Commercial (Alibaba)">Wan 3.0 Commercial (Alibaba)</option>
                    <option value="Seedream 5.0 Pro (ByteDance)">Seedream 5.0 Pro (ByteDance)</option>
                    <option value="FLUX.1 Commercial Fill">FLUX.1 Commercial Fill</option>
                    <option value="Wan 3.0 Dialogue & LipSync">Wan 3.0 Dialogue & LipSync</option>
                  </select>
                </div>

                {/* Style Selector */}
                <div className="mkt-select-btn">
                  <select value={stylePreset} onChange={(e) => setStylePreset(e.target.value)}>
                    <option value="สมจริงภาพยนตร์">สไตล์: สมจริงภาพยนตร์ (Cinematic)</option>
                    <option value="UGC TikTok / Reels">สไตล์: UGC TikTok / Reels (Casual)</option>
                    <option value="โฆษณาสตูดิโอหรูหรา">สไตล์: สตูดิโอโฆษณาหรูหรา (Luxury)</option>
                    <option value="ธรรมชาติสตรีทฟู้ด">สไตล์: ธรรมชาติสตรีทฟู้ด & คาเฟ่</option>
                    <option value="อนิเมะ & แฟนตาซี">สไตล์: อนิเมะพรีเซนเตอร์</option>
                  </select>
                </div>

                {/* Aspect Ratio */}
                <div className="mkt-select-btn">
                  <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                    <option value="9:16">9:16 (TikTok/Reels)</option>
                    <option value="16:9">16:9 (YouTube/จอแนวนอน)</option>
                    <option value="1:1">1:1 (Square IG Feed)</option>
                    <option value="4:3">4:3 (Classic Video)</option>
                  </select>
                </div>

                {/* Resolution */}
                <div className="mkt-select-btn">
                  <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                    <option value="720P">720P</option>
                    <option value="1080P">1080P (FHD)</option>
                    <option value="2K">2K (UHD)</option>
                  </select>
                </div>

                {/* Duration */}
                {activeTab !== 'image' && (
                  <div className="mkt-select-btn">
                    <Clock size={14} />
                    <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                      <option value="4 วินาที">4 วินาที</option>
                      <option value="8 วินาที">8 วินาที</option>
                      <option value="10 วินาที">10 วินาที</option>
                      <option value="12 วินาที">12 วินาที</option>
                      <option value="15 วินาที">15 วินาที</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                className="mkt-submit-btn"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> กำลังสร้าง ({generationProgress}%)...
                  </>
                ) : (
                  <>
                    <span>สร้าง</span>
                    <span className="mkt-credit-pill">
                      ✦ {activeTab === 'image' ? '36-48' : '444'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Result Preview Banner (When Generated) */}
          {generatedOutput && (
            <div className="mkt-preview-panel">
              <div className="mkt-preview-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} color="#00f0ff" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>ผลลัพธ์การสร้าง (Generated Output)</h3>
                  <span className="mkt-card-badge">{generatedOutput.model}</span>
                </div>
                <button
                  className="mkt-copy-btn"
                  onClick={() => setGeneratedOutput(null)}
                >
                  <X size={14} /> ปิดพรีวิว
                </button>
              </div>

              <div className="mkt-preview-content">
                <div className="mkt-preview-player">
                  <img src={generatedOutput.url} alt="Output result" />
                  <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: 8, fontSize: '0.75rem', color: '#fff' }}>
                    {aspectRatio} · {duration} · สำเร็จเมื่อ {generatedOutput.time}
                  </div>
                </div>

                <div className="mkt-preview-info">
                  <div style={{ background: '#0d0e14', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 4 }}>Prompt ที่ใช้สร้าง:</div>
                    <div style={{ fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {generatedOutput.prompt}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
                    <a
                      href={generatedOutput.url}
                      download="marketing-studio-result.jpg"
                      className="mkt-use-btn"
                      style={{ textDecoration: 'none' }}
                    >
                      ดาวน์โหลดไฟล์ (Download)
                    </a>
                    <button
                      className="mkt-copy-btn"
                      onClick={() => handleCopyPrompt('out', generatedOutput.prompt)}
                    >
                      {copiedId === 'out' ? <Check size={14} color="#00f0ff" /> : <Copy size={14} />} คัดลอกรายละเอียด
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Feature Tools Row (Dreamina Bottom Cards) */}
          <section className="mkt-features-section">
            <div className="mkt-features-scroll">
              {FEATURE_PRESETS.map((feat) => {
                const IconComponent = feat.icon
                return (
                  <div
                    key={feat.id}
                    className="mkt-feature-card"
                    onClick={() => {
                      setPrompt(feat.promptTemplate)
                      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                  >
                    <img src={feat.bg} alt={feat.title} className="mkt-feature-card-bg" />
                    <IconComponent size={18} className="mkt-feature-icon" />
                    <div className="mkt-feature-title">{feat.title}</div>
                    <div className="mkt-feature-desc">{feat.desc}</div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* 4. GitHub Prompts Showcase & Library (From Wan 3.0 Repo) */}
          <section>
            <div className="mkt-showcase-header">
              <div>
                <div className="mkt-showcase-title">
                  <Sparkles size={20} color="#00f0ff" />
                  <span>คลังสูตรพรอมต์ Wan 3.0 สำหรับการตลาด & UGC</span>
                </div>
                <div className="mkt-showcase-sub">
                  ดึงสูตร Directing Briefs จาก Repo <code>flaqai/awesome_wan-3-0-prompts</code> พร้อมโครงสร้างคุมหน้าคน สินค้า และฉาก
                </div>
              </div>

              {/* Search Box */}
              <input
                type="text"
                placeholder="ค้นหาพรอมต์ เช่น อาหาร, รีวิว, ส้มตำ, เซรั่ม..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: '#161822',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: '8px 14px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  minWidth: 260
                }}
              />
            </div>

            {/* Category Filter Pills */}
            <div className="mkt-filter-pills">
              <button
                className={`mkt-pill-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                ทั้งหมด ({MARKETING_PROMPTS.length})
              </button>
              <button
                className={`mkt-pill-btn ${selectedCategory === 'featured' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('featured')}
              >
                ⭐ พรอมต์แนะนำ (Featured)
              </button>
              <button
                className={`mkt-pill-btn ${selectedCategory === 'ugc_food_travel' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('ugc_food_travel')}
              >
                🍜 UGC อาหาร & ท่องเที่ยว
              </button>
              <button
                className={`mkt-pill-btn ${selectedCategory === 'ads_products' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('ads_products')}
              >
                💎 โฆษณาสินค้า & ดีไซน์
              </button>
              <button
                className={`mkt-pill-btn ${selectedCategory === 'beauty_retail' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('beauty_retail')}
              >
                💄 คอมเมิร์ซ & บิวตี้
              </button>
              <button
                className={`mkt-pill-btn ${selectedCategory === 'dialogue_review' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('dialogue_review')}
              >
                🎙️ คน & บทพูดรีวิว
              </button>
              <button
                className={`mkt-pill-btn ${selectedCategory === 'social_ugc' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('social_ugc')}
              >
                🎬 โซเชียลคอมเมดี้ & ไวรัล
              </button>
            </div>

            {/* Prompt Cards Grid */}
            <div className="mkt-prompt-grid">
              {filteredPrompts.map((item) => (
                <div key={item.id} className="mkt-prompt-card">
                  <div>
                    <div className="mkt-card-top">
                      <div className="mkt-card-title">{item.title}</div>
                      <span className="mkt-card-badge">{item.mode}</span>
                    </div>

                    <div className="mkt-card-meta">
                      <span className="mkt-meta-pill">{item.categoryName}</span>
                      <span className="mkt-meta-pill">{item.duration}</span>
                      <span className="mkt-meta-pill">{item.aspectRatio}</span>
                      {item.badge && <span className="mkt-meta-pill" style={{ color: '#00f0ff' }}>{item.badge}</span>}
                    </div>

                    <div className="mkt-card-prompt-preview" style={{ marginTop: 12 }}>
                      {item.prompt}
                    </div>
                  </div>

                  <div className="mkt-card-actions">
                    <button
                      className="mkt-use-btn"
                      onClick={() => handleUsePrompt(item)}
                    >
                      <Sparkles size={14} /> นำไปใช้ในสตูดิโอ
                    </button>
                    <button
                      className="mkt-copy-btn"
                      onClick={() => handleCopyPrompt(item.id, item.prompt)}
                      title="คัดลอกพรอมต์"
                    >
                      {copiedId === item.id ? <Check size={14} color="#00f0ff" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Modal for Picking Sample Images or Uploading */}
        {pickerType && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: '1rem',
            }}
            onClick={() => setPickerType(null)}
          >
            <div
              style={{
                background: '#161824',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20,
                width: '100%',
                maxWidth: 520,
                padding: '1.5rem',
                color: '#fff',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {pickerType === 'product' && <ShoppingCart size={18} color="#00f0ff" />}
                  {pickerType === 'avatar' && <User size={18} color="#00f0ff" />}
                  {pickerType === 'scene' && <MapPin size={18} color="#00f0ff" />}
                  เลือกรูปภาพอ้างอิง: {pickerType === 'product' ? 'สินค้า' : pickerType === 'avatar' ? 'อวตาร/นางแบบ' : 'สถานที่/ร้าน'}
                </h3>
                <button
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  onClick={() => setPickerType(null)}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Upload Local File Option */}
              <div
                style={{
                  border: '1px dashed rgba(0,240,255,0.4)',
                  borderRadius: 12,
                  padding: '1.25rem',
                  textAlign: 'center',
                  background: 'rgba(0,240,255,0.05)',
                  cursor: 'pointer',
                  marginBottom: '1.25rem',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={24} color="#00f0ff" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>อัปโหลดรูปภาพของคุณเองจากคอมพิวเตอร์</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>รองรับ JPG, PNG, WEBP (สูงสุด 10MB)</div>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Or Pick from Presets */}
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>
                หรือเลือกจากตัวอย่างสำเร็จรูป (Presets):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {(pickerType === 'product' ? SAMPLE_PRODUCTS : pickerType === 'avatar' ? SAMPLE_AVATARS : SAMPLE_SCENES).map((sample) => (
                  <div
                    key={sample.id}
                    style={{
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer',
                      background: '#0d0f17',
                    }}
                    onClick={() => {
                      const item: ReferenceItem = {
                        id: sample.id,
                        type: pickerType,
                        name: sample.name,
                        url: sample.url,
                      }
                      if (pickerType === 'product') setProductRef(item)
                      else if (pickerType === 'avatar') setAvatarRef(item)
                      else if (pickerType === 'scene') setSceneRef(item)
                      setPickerType(null)
                    }}
                  >
                    <div style={{ aspectRatio: '1', overflow: 'hidden' }}>
                      <img src={sample.url} alt={sample.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ padding: '6px 8px', fontSize: '0.75rem', fontWeight: 500, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {sample.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
