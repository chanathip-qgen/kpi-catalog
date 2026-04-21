import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Target, FileText, ChevronRight, ChevronLeft,
  Copy, Check, Download, Sparkles, BookOpen, Edit2,
  Users, Shield, Star, Loader2, CircleCheck, AlertCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fetchKPIData, type KPIData } from './data';
import { generateLearningSkills, type SkillSuggestion, type LearningContext } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Level = 'Manager' | 'Team Lead' | 'Officer';
type MeasurementLevel = 'Learn' | 'Apply' | 'Impact';

interface SelectedSkill {
  skill: SkillSuggestion;
  level: MeasurementLevel | null;
}

const MEASUREMENT_INFO: Record<MeasurementLevel, { label: string; description: string }> = {
  Learn:  { label: 'Learn',  description: 'เข้าใจแนวคิดและอธิบายได้' },
  Apply:  { label: 'Apply',  description: 'ปรับใช้จริงในงานที่ทำอยู่' },
  Impact: { label: 'Impact', description: 'วัดผลลัพธ์ได้ต่อทีม/องค์กร' },
};

const CATEGORIES_FOR_LEVEL: Record<Level, string[]> = {
  Manager:     ['CAT', 'Self Leadership', 'Team Leadership'],
  'Team Lead': ['CAT', 'Self Leadership', 'Team Leadership'],
  Officer:     ['CAT', 'Self Leadership'],
};

const CATEGORY_STEP: Record<string, number> = {
  CAT: 2,
  'Self Leadership': 3,
  'Team Leadership': 4,
};

const slideAnim = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -20 },
};

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [step, setStep]                   = useState(1);
  const [selectedLevel, setSelectedLevel] = useState<Level | ''>('');
  const [behaviorSelections, setBehaviorSelections] = useState<Record<string, KPIData>>({});
  const [kpiDatabase, setKpiDatabase]     = useState<KPIData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [learningContext, setLearningContext] = useState<LearningContext>({
    jobFunction: '', problems: '', skillsNeeded: '',
  });
  const [generatedSkills, setGeneratedSkills]       = useState<SkillSuggestion[]>([]);
  const [isGeneratingSkills, setIsGeneratingSkills] = useState(false);
  const [selectedSkills, setSelectedSkills]         = useState<SelectedSkill[]>([]);
  const [copySuccess, setCopySuccess]               = useState<string | null>(null);

  React.useEffect(() => {
    fetchKPIData()
      .then(setKpiDatabase)
      .catch(console.error)
      .finally(() => setIsLoadingData(false));
  }, []);

  const kpisByCategory = useMemo(() => {
    const g: Record<string, Record<string, KPIData[]>> = {};
    kpiDatabase.forEach(kpi => {
      if (!g[kpi.category]) g[kpi.category] = {};
      if (!g[kpi.category][kpi.type_code]) g[kpi.category][kpi.type_code] = [];
      g[kpi.category][kpi.type_code].push(kpi);
    });
    return g;
  }, [kpiDatabase]);

  const getTypeCodes = useCallback(
    (cat: string) => Object.keys(kpisByCategory[cat] ?? {}),
    [kpisByCategory]
  );

  const isBehaviorCategoryComplete = useCallback(
    (cat: string) => getTypeCodes(cat).every(tc => !!behaviorSelections[tc]),
    [getTypeCodes, behaviorSelections]
  );

  const nextStep = useCallback(() =>
    setStep(p => (p === 3 && selectedLevel === 'Officer' ? 5 : p + 1)),
    [selectedLevel]
  );
  const prevStep = useCallback(() =>
    setStep(p => (p === 5 && selectedLevel === 'Officer' ? 3 : p - 1)),
    [selectedLevel]
  );

  const handleGenerateSkills = async () => {
    setIsGeneratingSkills(true);
    setGeneratedSkills([]);
    setSelectedSkills([]);
    try {
      setGeneratedSkills(await generateLearningSkills(selectedLevel as string, learningContext));
    } catch (e) { console.error(e); }
    finally { setIsGeneratingSkills(false); }
  };

  const toggleSkillSelection = (skill: SkillSuggestion) => {
    setSelectedSkills(prev => {
      const exists = prev.find(s => s.skill.skill_name === skill.skill_name);
      if (exists) return prev.filter(s => s.skill.skill_name !== skill.skill_name);
      if (prev.length >= 3) return prev;
      return [...prev, { skill, level: null }];
    });
  };

  const setSkillLevel = (name: string, level: MeasurementLevel) =>
    setSelectedSkills(prev => prev.map(s => s.skill.skill_name === name ? { ...s, level } : s));

  const orderedBehaviorKPIs = useMemo(() => {
    const cats = selectedLevel ? CATEGORIES_FOR_LEVEL[selectedLevel] : [];
    const result: KPIData[] = [];
    cats.forEach(cat => getTypeCodes(cat).forEach(tc => {
      if (behaviorSelections[tc]) result.push(behaviorSelections[tc]);
    }));
    return result;
  }, [selectedLevel, getTypeCodes, behaviorSelections]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(id);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (e) { console.error(e); }
  };

  const copyBehaviorKPIs = () => copyToClipboard(
    orderedBehaviorKPIs.map(k =>
      `${k.kpi_name}\t${k.target}\t0%\t${k.score_1}\t${k.score_2}\t${k.score_3}\t${k.score_4}\t${k.score_5}`
    ).join('\n'), 'behavior'
  );

  const copyLearningKPIs = () => copyToClipboard(
    selectedSkills.filter(s => s.level).map(s => `${s.skill.skill_name}\t${s.level}`).join('\n'),
    'learning'
  );

  const downloadCSV = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      'Behavior KPI',
      ['Category','Dimension','KPI Name','Target','Weight','Score 1','Score 2','Score 3','Score 4','Score 5'].map(esc).join(','),
      ...orderedBehaviorKPIs.map(k =>
        [k.category,k.dimension,k.kpi_name,k.target,'0%',k.score_1,k.score_2,k.score_3,k.score_4,k.score_5].map(esc).join(',')
      ),
      '', 'Learning KPI',
      ['KPI Name','Target'].map(esc).join(','),
      ...selectedSkills.filter(s => s.level).map(s => [s.skill.skill_name, s.level!].map(esc).join(',')),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `KPI_Assessment_${selectedLevel}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Stepper
  const visibleSteps = useMemo(() => {
    const base = [
      { num: 1, label: 'ระดับ',   icon: <User size={14} /> },
      { num: 2, label: 'CAT',     icon: <Target size={14} /> },
      { num: 3, label: 'Self',    icon: <Shield size={14} /> },
    ];
    if (selectedLevel !== 'Officer')
      base.push({ num: 4, label: 'Team', icon: <Users size={14} /> });
    base.push(
      { num: 5, label: 'Behavior', icon: <FileText size={14} /> },
      { num: 6, label: 'Learning', icon: <Sparkles size={14} /> },
      { num: 7, label: 'Skills',   icon: <BookOpen size={14} /> },
      { num: 8, label: 'สรุป',     icon: <Star size={14} /> }
    );
    return base;
  }, [selectedLevel]);

  const displayStep = useMemo(() => {
    if (selectedLevel === 'Officer' && step >= 5) return step - 1;
    return step;
  }, [selectedLevel, step]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F2F4F8] font-sans">

      {/* Header */}
      <header className="mb-8 text-center pt-8">
        <h1 className="text-3xl font-bold text-[#3B5BDB] mb-1">KPI Catalog</h1>
        <p className="text-[#9BA8C4] text-sm">ระบบสร้างใบประเมิน KPI — Behavior & Learning</p>
      </header>

      <div className={cn('mx-auto px-4 md:px-6 pb-8', step === 8 ? 'max-w-screen-xl' : 'max-w-5xl')}>

        {/* Stepper */}
        <div className="flex justify-center mb-8 overflow-x-auto py-2">
          <div className="flex items-center gap-1 overflow-visible">
            {visibleSteps.map((s, i) => {
              const isActive    = displayStep === i + 1;
              const isCompleted = displayStep > i + 1;
              return (
                <React.Fragment key={s.num}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-all text-xs',
                      isActive    && 'bg-[#3B5BDB] text-white shadow-md scale-110',
                      isCompleted && 'bg-[#3B5BDB]/15 text-[#3B5BDB]',
                      !isActive && !isCompleted && 'bg-white border border-[#E0E4EF] text-[#9BA8C4]'
                    )}>
                      {isCompleted ? <Check size={13} strokeWidth={2.5} /> : s.icon}
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium whitespace-nowrap',
                      isActive    ? 'text-[#3B5BDB]' : 'text-[#9BA8C4]'
                    )}>
                      {s.label}
                    </span>
                  </div>
                  {i < visibleSteps.length - 1 && (
                    <div className={cn(
                      'h-px w-6 mb-4 transition-colors',
                      isCompleted ? 'bg-[#3B5BDB]/40' : 'bg-[#E0E4EF]'
                    )} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-sm overflow-hidden min-h-[500px]">
          {isLoadingData ? (
            <div className="flex flex-col items-center justify-center h-[500px] gap-3">
              <Loader2 size={28} className="animate-spin text-[#3B5BDB]" />
              <p className="text-sm text-[#9BA8C4]">กำลังโหลดข้อมูล...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">

              {/* ── Step 1: Level ─────────────────────────────────────────── */}
              {step === 1 && (
                <motion.div key="s1" {...slideAnim} className="p-8">
                  <h2 className="text-lg font-bold text-[#0F1117] mb-1">เลือกระดับพนักงาน</h2>
                  <p className="text-sm text-[#9BA8C4] mb-8">ระดับที่เลือกจะกำหนดหมวด KPI ที่ต้องประเมิน</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
                    {(['Manager', 'Team Lead', 'Officer'] as Level[]).map(lvl => {
                      const meta = LEVEL_META[lvl];
                      const isSelected = selectedLevel === lvl;
                      return (
                        <button
                          key={lvl}
                          onClick={() => setSelectedLevel(lvl)}
                          className={cn(
                            'p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-3 text-center',
                            isSelected
                              ? 'border-[#3B5BDB] bg-[#EEF2FF]'
                              : 'border-[#E8EAF0] hover:border-[#C5CBE0] bg-white'
                          )}
                        >
                          <div className={cn(
                            'w-11 h-11 rounded-xl flex items-center justify-center',
                            isSelected ? 'bg-[#3B5BDB] text-white' : 'bg-[#F2F4F8] text-[#9BA8C4]'
                          )}>
                            {meta.icon}
                          </div>
                          <div>
                            <div className="font-bold text-[#0F1117]">{lvl}</div>
                            <div className="text-xs text-[#9BA8C4] mt-0.5">{meta.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-end">
                    <PrimaryButton onClick={() => setStep(2)} disabled={!selectedLevel}>
                      ถัดไป <ChevronRight size={16} />
                    </PrimaryButton>
                  </div>
                </motion.div>
              )}

              {/* ── Steps 2–4: Behavior KPI ───────────────────────────────── */}
              {step === 2 && (
                <BehaviorSection key="s2" category="CAT"
                  kpisByCategory={kpisByCategory} selections={behaviorSelections}
                  onSelect={(tc, kpi) => setBehaviorSelections(p => ({ ...p, [tc]: kpi }))}
                  isComplete={isBehaviorCategoryComplete('CAT')}
                  onNext={nextStep} onPrev={prevStep} />
              )}
              {step === 3 && (
                <BehaviorSection key="s3" category="Self Leadership"
                  kpisByCategory={kpisByCategory} selections={behaviorSelections}
                  onSelect={(tc, kpi) => setBehaviorSelections(p => ({ ...p, [tc]: kpi }))}
                  isComplete={isBehaviorCategoryComplete('Self Leadership')}
                  onNext={nextStep} onPrev={prevStep} />
              )}
              {step === 4 && (
                <BehaviorSection key="s4" category="Team Leadership"
                  kpisByCategory={kpisByCategory} selections={behaviorSelections}
                  onSelect={(tc, kpi) => setBehaviorSelections(p => ({ ...p, [tc]: kpi }))}
                  isComplete={isBehaviorCategoryComplete('Team Leadership')}
                  onNext={nextStep} onPrev={prevStep} />
              )}

              {/* ── Step 5: Behavior Summary ──────────────────────────────── */}
              {step === 5 && (
                <motion.div key="s5" {...slideAnim} className="p-6 md:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-[#0F1117] flex items-center gap-2">
                        <FileText size={18} className="text-[#3B5BDB]" />
                        สรุป Behavior KPI
                      </h2>
                      <p className="text-sm text-[#9BA8C4] mt-0.5">
                        ระดับ <span className="font-semibold text-[#6B7280]">{selectedLevel}</span> — {orderedBehaviorKPIs.length} ตัวชี้วัด
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {(selectedLevel ? CATEGORIES_FOR_LEVEL[selectedLevel] : []).map(cat => (
                        <button key={cat} onClick={() => setStep(CATEGORY_STEP[cat])}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs border border-[#E8EAF0] rounded-lg hover:bg-[#F2F4F8] text-[#6B7280] transition-colors">
                          <Edit2 size={11} /> {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-[#E8EAF0] rounded-xl">
                    <table className="w-full text-left min-w-[900px]">
                      <thead>
                        <tr className="bg-[#0F1117] text-white text-xs">
                          <th className="px-3 py-3 font-semibold uppercase w-[10%] border-r border-white/10" rowSpan={2}>Category</th>
                          <th className="px-3 py-3 font-semibold uppercase w-[12%] border-r border-white/10" rowSpan={2}>Dimension</th>
                          <th className="px-3 py-3 font-semibold uppercase w-[20%] border-r border-white/10" rowSpan={2}>KPI Name</th>
                          <th className="px-3 py-3 font-semibold uppercase w-[15%] border-r border-white/10" rowSpan={2}>Target</th>
                          <th colSpan={5} className="px-3 py-3 font-semibold uppercase text-center border-b border-white/10">Score</th>
                        </tr>
                        <tr className="bg-[#0F1117] text-white/70 text-xs">
                          {['1','2','3★','4','5'].map(s => (
                            <th key={s} className={cn(
                              'px-2 py-2 text-center font-semibold border-r border-white/10 last:border-r-0',
                              s === '3★' && 'bg-[#3B5BDB] text-white'
                            )}>{s}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F2F8]">
                        {orderedBehaviorKPIs.map((k, idx) => (
                          <tr key={idx} className="hover:bg-[#FAFBFD]">
                            <td className="px-3 py-3 text-xs border-r border-[#F0F2F8]">
                              <span className="px-1.5 py-0.5 rounded bg-[#F0F2F8] text-[#6B7280] font-bold text-[10px]">{k.category}</span>
                            </td>
                            <td className="px-3 py-3 text-xs text-[#6B7280] border-r border-[#F0F2F8]">{k.dimension}</td>
                            <td className="px-3 py-3 text-xs font-medium text-[#0F1117] border-r border-[#F0F2F8]">{k.kpi_name}</td>
                            <td className="px-3 py-3 text-xs text-[#6B7280] border-r border-[#F0F2F8]">{k.target}</td>
                            {[k.score_1,k.score_2,k.score_3,k.score_4,k.score_5].map((s,si) => (
                              <td key={si} className={cn('px-2 py-3 text-xs text-[#6B7280] border-r border-[#F0F2F8] last:border-r-0', si===2 && 'bg-[#EEF2FF] text-[#3B5BDB]')}>{s}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-8 flex justify-between">
                    <GhostButton onClick={prevStep}><ChevronLeft size={16} /> ย้อนกลับ</GhostButton>
                    <PrimaryButton onClick={nextStep}>ถัดไป: Learning KPI <ChevronRight size={16} /></PrimaryButton>
                  </div>
                </motion.div>
              )}

              {/* ── Step 6: Learning Context ──────────────────────────────── */}
              {step === 6 && (
                <motion.div key="s6" {...slideAnim} className="p-6 md:p-8">
                  <h2 className="text-lg font-bold text-[#0F1117] mb-1 flex items-center gap-2">
                    <Sparkles size={18} className="text-[#3B5BDB]" /> Learning KPI
                  </h2>
                  <p className="text-sm text-[#9BA8C4] mb-8">กรอกข้อมูลเพื่อให้ AI แนะนำทักษะที่เหมาะสมกับคุณโดยเฉพาะ</p>

                  <div className="space-y-6">
                    <div className="space-y-4 p-5 bg-[#F8F9FC] rounded-2xl border border-[#E8EAF0]">
                      <p className="text-xs font-semibold text-[#0F1117]">ตอบคำถามต่อไปนี้เพื่อให้ AI วิเคราะห์ได้แม่นยำขึ้น</p>
                      <ContextInput number={1}
                        label="คุณทำงานอะไร / อยู่ใน function ไหน?"
                        placeholder="เช่น ดูแลการตลาดออนไลน์ รับผิดชอบ content และ campaign ทำงานร่วมกับทีม Sales..."
                        value={learningContext.jobFunction}
                        onChange={v => setLearningContext(p => ({ ...p, jobFunction: v }))} />
                      <ContextInput number={2}
                        label="เจอปัญหาหรือ gap อะไรในการทำงานช่วงนี้?"
                        placeholder="เช่น ยังวิเคราะห์ data ไม่เก่ง สื่อสารกับ stakeholder ได้ไม่ดีพอ..."
                        value={learningContext.problems}
                        onChange={v => setLearningContext(p => ({ ...p, problems: v }))} />
                      <ContextInput number={3}
                        label="อยากพัฒนาสกิลด้านใดเป็นพิเศษ?"
                        placeholder="เช่น อยากเก่งเรื่อง data visualization อยากพัฒนา presentation skill..."
                        value={learningContext.skillsNeeded}
                        onChange={v => setLearningContext(p => ({ ...p, skillsNeeded: v }))} />
                    </div>

                    <button onClick={handleGenerateSkills} disabled={isGeneratingSkills}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#3B5BDB] text-white rounded-xl font-semibold hover:bg-[#3451C7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      {isGeneratingSkills
                        ? <><Loader2 size={16} className="animate-spin" /> กำลังวิเคราะห์...</>
                        : <><Sparkles size={16} /> ให้ AI วิเคราะห์และแนะนำทักษะ</>}
                    </button>

                    {generatedSkills.length > 0 && (
                      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <CircleCheck size={15} className="text-emerald-500 shrink-0" />
                        <p className="text-sm font-medium text-emerald-700">
                          AI แนะนำ {generatedSkills.length} ทักษะแล้ว — กด "ถัดไป" เพื่อเลือก
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex justify-between">
                    <GhostButton onClick={prevStep}><ChevronLeft size={16} /> ย้อนกลับ</GhostButton>
                    <PrimaryButton onClick={nextStep} disabled={generatedSkills.length === 0}>
                      ถัดไป <ChevronRight size={16} />
                    </PrimaryButton>
                  </div>
                </motion.div>
              )}

              {/* ── Step 7: Skill Selection ───────────────────────────────── */}
              {step === 7 && (
                <motion.div key="s7" {...slideAnim} className="p-6 md:p-8">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-bold text-[#0F1117] flex items-center gap-2">
                      <BookOpen size={18} className="text-[#3B5BDB]" /> เลือกทักษะที่จะพัฒนา
                    </h2>
                    <span className={cn(
                      'text-sm font-semibold px-3 py-1 rounded-full',
                      selectedSkills.length >= 1
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        : 'bg-[#F2F4F8] text-[#9BA8C4]'
                    )}>
                      {selectedSkills.length}/3
                    </span>
                  </div>
                  <p className="text-sm text-[#9BA8C4] mb-6">เลือก <strong className="text-[#0F1117]">1–3 ทักษะ</strong> จากที่ AI แนะนำ แล้วกำหนดระดับที่คาดหวัง</p>

                  {(['Technical', 'Soft Skill'] as const).map(type => {
                    const skills = generatedSkills.filter(s => s.skill_type === type);
                    return (
                      <div key={type} className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <span className={cn(
                            'text-xs font-bold px-3 py-1 rounded-full',
                            type === 'Technical'
                              ? 'bg-violet-50 text-violet-600 border border-violet-100'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          )}>
                            {type === 'Technical' ? '⚙️ Technical Skill' : '💬 Soft Skill'} ({skills.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {skills.map((skill, i) => {
                            const isSelected = selectedSkills.some(s => s.skill.skill_name === skill.skill_name);
                            const isDisabled = !isSelected && selectedSkills.length >= 3;
                            return (
                              <div key={i} onClick={() => !isDisabled && toggleSkillSelection(skill)}
                                className={cn(
                                  'p-4 rounded-xl border-2 transition-all cursor-pointer',
                                  isSelected  ? 'border-[#3B5BDB] bg-[#EEF2FF]/60' :
                                  isDisabled  ? 'border-[#E8EAF0] bg-[#F8F9FC] opacity-40 cursor-not-allowed' :
                                  'border-[#E8EAF0] bg-white hover:border-[#C5CBE0]'
                                )}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#3B5BDB] mb-2 inline-block">
                                      {skill.skill_category}
                                    </span>
                                    <div className="font-semibold text-[#0F1117] text-sm mb-1">{skill.skill_name}</div>
                                    <div className="text-xs text-[#9BA8C4]">{skill.relevance}</div>
                                  </div>
                                  <div className={cn(
                                    'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1',
                                    isSelected ? 'border-[#3B5BDB] bg-[#3B5BDB]' : 'border-[#CDD2E0]'
                                  )}>
                                    {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {selectedSkills.length > 0 && (
                    <div className="space-y-3 mb-8">
                      <p className="font-semibold text-sm text-[#0F1117]">กำหนดระดับที่คาดหวังสำหรับแต่ละทักษะ</p>
                      {selectedSkills.map((s, i) => (
                        <div key={i} className="p-4 rounded-xl border border-[#E8EAF0] bg-[#F8F9FC]">
                          <div className="text-sm font-semibold text-[#0F1117] mb-3">{s.skill.skill_name}</div>
                          <div className="flex flex-wrap gap-2">
                            {(['Learn','Apply','Impact'] as MeasurementLevel[]).map(lvl => {
                              const isActive = s.level === lvl;
                              return (
                                <button key={lvl} onClick={() => setSkillLevel(s.skill.skill_name, lvl)}
                                  className={cn(
                                    'px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all',
                                    isActive
                                      ? 'border-[#3B5BDB] bg-[#3B5BDB] text-white'
                                      : 'border-[#E8EAF0] bg-white text-[#6B7280] hover:border-[#C5CBE0]'
                                  )}>
                                  {lvl}
                                  <span className={cn('ml-1.5 text-xs font-normal hidden md:inline', isActive ? 'text-blue-200' : 'text-[#9BA8C4]')}>
                                    — {MEASUREMENT_INFO[lvl].description}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedSkills.length >= 1 && selectedSkills.some(s => !s.level) && (
                    <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <AlertCircle size={14} className="text-amber-500 shrink-0" />
                      <p className="text-xs text-amber-700">กรุณากำหนดระดับที่คาดหวังให้ครบทุกทักษะ</p>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <GhostButton onClick={prevStep}><ChevronLeft size={16} /> ย้อนกลับ</GhostButton>
                    <PrimaryButton onClick={nextStep} disabled={selectedSkills.length < 1 || selectedSkills.some(s => !s.level)}>
                      ดูสรุปรวม <ChevronRight size={16} />
                    </PrimaryButton>
                  </div>
                </motion.div>
              )}

              {/* ── Step 8: Final Summary ─────────────────────────────────── */}
              {step === 8 && (
                <motion.div key="s8" {...slideAnim} className="p-6 md:p-8">
                  <div className="mb-8">
                    <h2 className="text-lg font-bold text-[#0F1117] flex items-center gap-2">สรุปใบประเมิน KPI</h2>
                    <p className="text-sm text-[#9BA8C4] mt-0.5">ระดับ: <span className="font-semibold text-[#6B7280]">{selectedLevel}</span></p>
                  </div>

                  {/* Behavior KPI */}
                  <SummarySection title="Behavior KPI" count={orderedBehaviorKPIs.length} onEdit={() => setStep(2)} accent="#3B5BDB" />
                  <div className="overflow-hidden border border-[#E8EAF0] rounded-xl mb-3">
                    <table className="w-full text-left table-fixed">
                      <thead>
                        <tr className="bg-[#0F1117] text-white text-xs">
                          <th className="px-2 py-2.5 font-semibold uppercase w-[22%] border-r border-white/10" rowSpan={2}>KPI Name</th>
                          <th className="px-2 py-2.5 font-semibold uppercase w-[12%] border-r border-white/10" rowSpan={2}>Target</th>
                          <th className="px-2 py-2.5 font-semibold uppercase w-[5%] text-center border-r border-white/10" rowSpan={2}>Wt.</th>
                          <th colSpan={5} className="px-2 py-2.5 font-semibold uppercase text-center border-b border-white/10">Score</th>
                          <th className="w-10" rowSpan={2} />
                        </tr>
                        <tr className="bg-[#0F1117] text-white/70 text-xs">
                          {['1','2','3★','4','5'].map(s => (
                            <th key={s} className={cn('px-1.5 py-2 text-center font-semibold border-r border-white/10 last:border-r-0 w-[11%]', s==='3★' && 'bg-[#3B5BDB] text-white')}>{s}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F2F8]">
                        {orderedBehaviorKPIs.map((k, idx) => {
                          const rk = `brow-${idx}`;
                          const rt = `${k.kpi_name}\t${k.target}\t0%\t${k.score_1}\t${k.score_2}\t${k.score_3}\t${k.score_4}\t${k.score_5}`;
                          return (
                            <tr key={idx} className="hover:bg-[#FAFBFD]">
                              <td className="px-2 py-2.5 text-xs border-r border-[#F0F2F8]">
                                <div className="text-[10px] font-bold text-[#9BA8C4] mb-0.5">[{k.type_code} — {k.dimension}]</div>
                                <div className="font-medium text-[#0F1117] leading-snug">{k.kpi_name}</div>
                              </td>
                              <td className="px-2 py-2.5 text-xs text-[#6B7280] border-r border-[#F0F2F8] leading-snug">{k.target}</td>
                              <td className="px-2 py-2.5 text-xs text-[#9BA8C4] text-center border-r border-[#F0F2F8]">0%</td>
                              {[k.score_1,k.score_2,k.score_3,k.score_4,k.score_5].map((s,si) => (
                                <td key={si} className={cn('px-1.5 py-2.5 text-[11px] text-[#6B7280] border-r border-[#F0F2F8] last:border-r-0 leading-snug', si===2 && 'bg-[#EEF2FF]/60 text-[#3B5BDB]')}>{s}</td>
                              ))}
                              <td className="px-2 py-3">
                                <button onClick={() => copyToClipboard(rt, rk)} className="p-1 text-[#CDD2E0] hover:text-[#6B7280] transition-colors">
                                  {copySuccess===rk ? <Check size={13} className="text-emerald-500"/> : <Copy size={13}/>}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2 justify-end mb-8">
                    <button onClick={copyBehaviorKPIs}
                      className="flex items-center gap-2 px-3 py-2 bg-[#0F1117] text-white rounded-lg text-xs font-medium hover:bg-[#1E2235] transition-colors">
                      {copySuccess==='behavior' ? <Check size={13}/> : <Copy size={13}/>} Copy Behavior KPI
                    </button>
                    <button onClick={downloadCSV}
                      className="flex items-center gap-2 px-3 py-2 border border-[#E8EAF0] text-[#0F1117] rounded-lg text-xs font-medium hover:bg-[#F2F4F8] transition-colors">
                      <Download size={13} /> Download CSV
                    </button>
                  </div>

                  {/* Learning KPI */}
                  <SummarySection title="Learning KPI" count={selectedSkills.length} onEdit={() => setStep(7)} accent="#3B5BDB" indigo />
                  <div className="overflow-x-auto border border-[#E8EAF0] rounded-xl mb-3">
                    <table className="w-full text-left min-w-[700px]">
                      <thead>
                        <tr className="bg-[#3B5BDB] text-white text-xs">
                          <th className="px-3 py-3 font-semibold uppercase w-[28%] border-r border-white/20">KPI Name</th>
                          <th className="px-3 py-3 font-semibold uppercase w-[10%] border-r border-white/20">Target</th>
                          <th className="px-3 py-3 font-semibold w-[20%] text-center border-r border-white/20">1</th>
                          <th className="px-3 py-3 font-semibold w-[20%] text-center border-r border-white/20">2</th>
                          <th className="px-3 py-3 font-semibold w-[20%] text-center bg-[#2B4EC7]">3 ★</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F2F8]">
                        {selectedSkills.map((s, idx) => {
                          const rk = `lrow-${idx}`;
                          const rt = `${s.skill.skill_name}\t${s.level}`;
                          return (
                            <tr key={idx} className="hover:bg-[#FAFBFD]">
                              <td className="px-3 py-3 text-xs font-medium text-[#0F1117] border-r border-[#F0F2F8]">
                                <div className="text-[10px] font-semibold text-[#9BA8C4] mb-0.5">{s.skill.skill_type}</div>
                                {s.skill.skill_name}
                              </td>
                              <td className="px-3 py-3 text-xs font-bold text-[#3B5BDB] border-r border-[#F0F2F8]">{s.level}</td>
                              <td className="px-3 py-3 text-xs text-[#9BA8C4] text-center border-r border-[#F0F2F8]">ทำได้ต่ำกว่าความคาดหวัง</td>
                              <td className="px-3 py-3 text-xs text-[#9BA8C4] text-center border-r border-[#F0F2F8]">ทำได้บางส่วน ยังไม่ถึงระดับที่คาดหวัง</td>
                              <td className="px-3 py-3 text-xs text-[#9BA8C4] text-center bg-[#EEF2FF]/40">ทำได้ตามที่คาดหวัง หรือเกินกว่า</td>
                              <td className="px-2 py-3">
                                <button onClick={() => copyToClipboard(rt, rk)} className="p-1 text-[#CDD2E0] hover:text-[#6B7280] transition-colors">
                                  {copySuccess===rk ? <Check size={13} className="text-emerald-500"/> : <Copy size={13}/>}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2 justify-end mb-8">
                    <button onClick={copyLearningKPIs}
                      className="flex items-center gap-2 px-3 py-2 bg-[#3B5BDB] text-white rounded-lg text-xs font-medium hover:bg-[#3451C7] transition-colors">
                      {copySuccess==='learning' ? <Check size={13}/> : <Copy size={13}/>} Copy Learning KPI
                    </button>
                    <button onClick={downloadCSV}
                      className="flex items-center gap-2 px-3 py-2 border border-[#E8EAF0] text-[#0F1117] rounded-lg text-xs font-medium hover:bg-[#F2F4F8] transition-colors">
                      <Download size={13} /> Download CSV
                    </button>
                  </div>

                  <GhostButton onClick={prevStep}><ChevronLeft size={16} /> ย้อนกลับ</GhostButton>
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_META = {
  Manager:     { icon: <User size={20} />,   desc: 'ผู้จัดการ',   categories: ['CAT','Self Leadership','Team Leadership'] },
  'Team Lead': { icon: <Users size={20} />,  desc: 'หัวหน้าทีม', categories: ['CAT','Self Leadership','Team Leadership'] },
  Officer:     { icon: <Shield size={20} />, desc: 'พนักงาน',     categories: ['CAT','Self Leadership'] },
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

function BehaviorSection({ category, kpisByCategory, selections, onSelect, isComplete, onNext, onPrev }: {
  category: string;
  kpisByCategory: Record<string, Record<string, KPIData[]>>;
  selections: Record<string, KPIData>;
  onSelect: (tc: string, kpi: KPIData) => void;
  isComplete: boolean;
  onNext: () => void;
  onPrev: () => void;
}) {
  const catKPIs   = kpisByCategory[category] ?? {};
  const typeCodes = Object.keys(catKPIs);
  const done      = typeCodes.filter(tc => !!selections[tc]).length;

  return (
    <motion.div {...slideAnim} className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-[#0F1117]">{category}</h2>
          <p className="text-sm text-[#9BA8C4] mt-0.5">เลือก 1 ตัวชี้วัด ต่อ 1 มิติ</p>
        </div>
        <span className={cn(
          'text-sm font-semibold px-3 py-1 rounded-full',
          isComplete ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-[#F2F4F8] text-[#9BA8C4]'
        )}>
          {done}/{typeCodes.length}
        </span>
      </div>

      <div className="space-y-8">
        {typeCodes.map((typeCode, dimIdx) => {
          const options   = catKPIs[typeCode];
          const dimension = options[0]?.dimension ?? typeCode;
          const selected  = selections[typeCode];

          return (
            <div key={typeCode}>
              {/* Dimension label */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl font-black text-[#E0E4EF] leading-none tabular-nums select-none">
                  {String(dimIdx + 1).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[#EEF2FF] text-[#3B5BDB] rounded-full">{typeCode}</span>
                <span className="font-semibold text-[#0F1117] text-sm">{dimension}</span>
                {selected && <CircleCheck size={15} className="text-emerald-500 ml-auto" />}
              </div>

              {/* Option cards */}
              <div className="space-y-2">
                {options.map((kpi, i) => {
                  const isSelected = selected?.option === kpi.option;
                  return (
                    <div key={i} onClick={() => onSelect(typeCode, kpi)}
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all bg-white',
                        isSelected
                          ? 'border-[#3B5BDB] ring-1 ring-[#3B5BDB]'
                          : 'border-[#E8EAF0] hover:border-[#C5CBE0]'
                      )}>
                      {/* Radio */}
                      <div className={cn(
                        'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                        isSelected ? 'border-[#3B5BDB] bg-[#3B5BDB]' : 'border-[#CDD2E0]'
                      )}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1">
                        <div className={cn('text-[10px] font-bold mb-0.5', isSelected ? 'text-[#3B5BDB]' : 'text-[#9BA8C4]')}>
                          {kpi.option}
                        </div>
                        <div className="text-sm font-medium text-[#0F1117] leading-snug mb-1">{kpi.kpi_name}</div>
                        <div className="text-xs text-[#9BA8C4] line-clamp-1">{kpi.target}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex justify-between">
        <GhostButton onClick={onPrev}><ChevronLeft size={16} /> ย้อนกลับ</GhostButton>
        <PrimaryButton onClick={onNext} disabled={!isComplete}>ถัดไป <ChevronRight size={16} /></PrimaryButton>
      </div>
    </motion.div>
  );
}

function PrimaryButton({ onClick, disabled = false, children }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 px-5 py-2.5 bg-[#0F1117] text-white rounded-xl text-sm font-semibold hover:bg-[#1E2235] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
      {children}
    </button>
  );
}

function GhostButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-5 py-2.5 border border-[#E8EAF0] text-[#6B7280] rounded-xl text-sm font-semibold hover:bg-[#F2F4F8] transition-colors">
      {children}
    </button>
  );
}

function ContextInput({ number, label, placeholder, value, onChange }: {
  number: number; label: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-[#3B5BDB] text-white text-[10px] font-bold flex items-center justify-center shrink-0">{number}</span>
        <span className="text-sm font-medium text-[#0F1117]">{label}</span>
      </label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2}
        className="w-full px-3 py-2.5 rounded-xl border border-[#E8EAF0] focus:ring-2 focus:ring-[#3B5BDB] focus:border-[#3B5BDB] outline-none resize-none text-sm text-[#0F1117] placeholder:text-[#CDD2E0] bg-white transition-shadow" />
    </div>
  );
}

function SummarySection({ title, count, onEdit, indigo = false }: {
  title: string; count: number; onEdit: () => void; accent?: string; indigo?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className={cn('w-1 h-5 rounded-full', indigo ? 'bg-[#3B5BDB]' : 'bg-[#3B5BDB]')} />
        <span className="font-bold text-[#0F1117]">{title}</span>
        <span className="text-xs text-[#9BA8C4]">({count} รายการ)</span>
      </div>
      <button onClick={onEdit}
        className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#3B5BDB] border border-[#E8EAF0] px-2.5 py-1 rounded-lg hover:border-[#3B5BDB]/30 transition-colors">
        <Edit2 size={11} /> แก้ไข
      </button>
    </div>
  );
}
