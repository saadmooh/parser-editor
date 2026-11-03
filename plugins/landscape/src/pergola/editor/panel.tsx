'use client'
import { type LevelNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { PanelSection, SliderControl, ToggleControl, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { PergolaNode, PERGOLA_KIND } from '../domain/schema'
import { PergolaIllustration } from './illustration'
import { pergolaArchMode, pergolaRoofLayout } from '../domain/layout'
import { pergolaParametrics } from './parametrics'
import { POST_DETAIL_OPTIONS, validPostDetailStyle } from '../domain/post-details'

const roofOptions = [
  { label: 'Open-slat pergola', roofForm: 'flat' },
  { label: 'Single-slope pergola', roofForm: 'single-slope' },
  { label: 'Gable pergola', roofForm: 'gable' },
  { label: 'Curved pergola', roofForm: 'curved' },
] as const

const selectClass = 'max-w-[58%] rounded-md border border-border/50 bg-[#2C2C2E] px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30'

export function PergolaPanel() {
  const selectedLevelId = useViewer((s) => s.selection.levelId)
  const selectedBuildingId = useViewer((s) => s.selection.buildingId)
  const placementLevelId = useScene((s) => {
    if (selectedLevelId && s.nodes[selectedLevelId]?.type === 'level') {
      return selectedLevelId
    }
    // Match the editor's building fallback, then prefer its ground floor.
    const building = selectedBuildingId
      ? s.nodes[selectedBuildingId]
      : Object.values(s.nodes).find((node) => node.type === 'building')
    const levels = Object.values(s.nodes).filter(
      (node): node is LevelNode =>
        node.type === 'level' && (!building || node.parentId === building.id),
    )
    return (
      levels.find((level) => level.level === 0)?.id ??
      levels.sort((a, b) => Math.abs(a.level) - Math.abs(b.level))[0]?.id ??
      null
    )
  })
  const active = useEditor((s) => s.tool === PERGOLA_KIND)
  const defaults = useEditor((s) => s.toolDefaults[PERGOLA_KIND])
  const pergola = PergolaNode.parse(defaults ?? {})
  const update = (patch: Partial<PergolaNode>) => {
    const editor = useEditor.getState()
    const current = PergolaNode.parse(editor.toolDefaults[PERGOLA_KIND] ?? {})
    const next = PergolaNode.parse({ ...current, ...patch })
    const derived = pergolaParametrics.derive?.(next, patch, current) ?? {}
    editor.setToolDefaults(PERGOLA_KIND, { ...editor.toolDefaults[PERGOLA_KIND], ...patch, ...derived })
  }
  const place = (roofForm: (typeof roofOptions)[number]['roofForm']) => {
    const editor = useEditor.getState()
    if (!placementLevelId) return
    const level = useScene.getState().nodes[placementLevelId]
    const building = level?.parentId
      ? useScene.getState().nodes[level.parentId as AnyNodeId]
      : undefined
    useViewer.getState().setSelection({
      ...(building?.type === 'building' ? { buildingId: building.id } : {}),
      levelId: placementLevelId,
    })
    update({ roofForm })
    editor.setMode('build')
    editor.setTool(PERGOLA_KIND)
  }
  const number = (key: 'width' | 'depth' | 'height' | 'backHeight' | 'roofRise' | 'sideOverhang' | 'endOverhang' |
    'postSize' | 'postBaseWidth' | 'postBaseHeight' | 'postTaper' | 'postBulge' |
    'beamWidth' | 'beamHeight' | 'rafterWidth' | 'rafterHeight' | 'rafterSpacing' |
    'slatSpacing' | 'slatWidth' | 'slatHeight' | 'gridCrossSpacing' | 'gridCrossWidth' | 'gridCrossHeight' |
    'memberEndCut' | 'braceCurve' | 'braceThickness' | 'braceReach' | 'braceDrop' |
    'gableArchDrop' | 'gableArchCurve' | 'archDepth' | 'screenHeight' | 'screenSlatWidth' | 'screenSlatGap',
    label: string, min: number, max: number, step = 0.01) =>
    <SliderControl label={label} value={key === 'sideOverhang' || key === 'endOverhang'
      ? pergola[key] ?? pergola.overhang : pergola[key]} min={min} max={max} step={step}
      precision={Math.max(0, Math.ceil(-Math.log10(step)))} unit="m"
      onChange={(value) => update({ [key]: value })} />
  const select = <K extends 'roofLayout' | 'postStyle' | 'postBaseStyle' | 'postShaftProfile' |
    'postDetailStyle' | 'braceStyle' | 'sideScreens' | 'screenStyle' | 'archMode' | 'archStyle' |
    'gridTopLayer' | 'memberEndStyle' | 'finish'>(key: K, label: string,
    value: NonNullable<PergolaNode[K]>, options: readonly { value: NonNullable<PergolaNode[K]>; label: string }[]) =>
    <label className="flex min-h-9 items-center justify-between gap-3 border-b border-border/50 px-2 text-xs text-foreground/80">
      <span>{label}</span>
      <select className={selectClass} value={value}
        onChange={(event) => update({ [key]: event.currentTarget.value } as Partial<PergolaNode>)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  return <section aria-label="Pergola placement settings" className="flex flex-col">
    <h3 className="px-2 pb-2 text-xs font-medium text-foreground">Roof style</h3>
    <div className="grid grid-cols-2 gap-2 px-2">
      {roofOptions.map(({ label, roofForm }) => {
        const selected = active && pergola.roofForm === roofForm
        return <button key={roofForm} type="button" aria-pressed={selected} disabled={!placementLevelId}
          onClick={() => place(roofForm)}
          className={`overflow-hidden rounded-md border text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-primary bg-accent/30 ring-1 ring-primary/50' : 'border-border bg-secondary/40 hover:bg-accent/30'}`}>
          <span aria-hidden="true" className="block aspect-[4/3] overflow-hidden">
            <PergolaIllustration roofForm={roofForm} />
          </span>
          <span className="block min-h-9 px-2 py-1.5 text-[11px] leading-4 text-foreground">{label}</span>
        </button>
      })}
    </div>
    <div className="mt-3 border-t border-border/70 pt-1">
      <PanelSection title="Placement defaults">
        {number('width', 'Width', 1.5, 10, 0.1)}
        {number('depth', 'Depth', 1.5, 8, 0.1)}
        {number('height', pergola.roofForm === 'single-slope' ? 'Front height' : 'Height', 1.8, 4, 0.1)}
        {pergola.roofForm === 'single-slope' && number('backHeight', 'Back height', 1.8, 4, 0.1)}
        {(pergola.roofForm === 'gable' || pergola.roofForm === 'curved') && number('roofRise', 'Roof rise', 0.2, 1.5, 0.05)}
        {number('sideOverhang', 'Side overhang', 0, 0.6)}
        {number('endOverhang', 'End overhang', 0, 0.6)}
      </PanelSection>
      <PanelSection title="Roof members" defaultExpanded={false}>
        {select('roofLayout', 'Layout', pergolaRoofLayout(pergola), [
          { value: 'rafters', label: 'Open rafters' }, { value: 'slatted', label: 'Shade slats' },
          { value: 'grid', label: 'Roof grid' },
        ])}
        {number('rafterWidth', 'Rafter width', 0.04, 0.12, 0.005)}
        {number('rafterHeight', 'Rafter height', 0.08, 0.25)}
        {number('rafterSpacing', 'Rafter spacing', 0.2, 0.8)}
        {pergolaRoofLayout(pergola) === 'slatted' && <>
          {number('slatWidth', 'Slat width', 0.03, 0.12)}
          {number('slatHeight', 'Slat height', 0.025, 0.12, 0.005)}
          {number('slatSpacing', 'Slat spacing', 0.1, 0.4)}
        </>}
        {pergolaRoofLayout(pergola) === 'grid' && <>
          {number('gridCrossWidth', 'Cross width', 0.04, 0.2)}
          {number('gridCrossHeight', 'Cross height', 0.04, 0.2)}
          {number('gridCrossSpacing', 'Grid spacing', 0.2, 1.2)}
          {select('gridTopLayer', 'Top layer', pergola.gridTopLayer, [
            { value: 'cross', label: 'Cross members' }, { value: 'rafters', label: 'Rafters' },
          ])}
        </>}
        {select('memberEndStyle', 'Member ends', pergola.memberEndStyle, [
          { value: 'square', label: 'Square' }, { value: 'beveled', label: 'Beveled' },
          { value: 'curved', label: 'Curved' },
        ])}
        {pergola.memberEndStyle !== 'square' && number('memberEndCut', 'End cut depth', 0.01, 0.12)}
      </PanelSection>
      <PanelSection title="Posts and beams" defaultExpanded={false}>
        {select('postStyle', 'Post profile', pergola.postStyle, [
          { value: 'square', label: 'Square' }, { value: 'chamfered', label: 'Chamfered' },
          { value: 'round', label: 'Round' }, { value: 'tapered', label: 'Tapered' },
        ])}
        {select('postBaseStyle', 'Post base', pergola.postBaseStyle, [
          { value: 'none', label: 'None' }, { value: 'simple-square', label: 'Simple' },
          { value: 'square-plinth', label: 'Square plinth' }, { value: 'round-rings', label: 'Round rings' },
          { value: 'steel-shoe', label: 'Steel shoe' },
        ])}
        {number('postSize', 'Post size', 0.08, 0.3)}
        {pergola.postBaseStyle !== 'none' && <>
          {number('postBaseWidth', 'Base width', 0.12, 0.6)}
          {number('postBaseHeight', 'Base height', 0.04, 0.4)}
        </>}
        {(pergola.postStyle === 'round' || pergola.postStyle === 'tapered') && <>
          {select('postShaftProfile', 'Shaft shape', pergola.postShaftProfile, [
            { value: 'straight', label: 'Straight' }, { value: 'bulged', label: 'Bulged' },
            { value: 'hourglass', label: 'Hourglass' },
          ])}
          {pergola.postShaftProfile !== 'straight' && number('postBulge', 'Shaft curve', 0.02, 0.3)}
        </>}
        {pergola.postStyle === 'tapered' && number('postTaper', 'Taper strength', 0.05, 0.45)}
        {select('postDetailStyle', 'Post detail', validPostDetailStyle(pergola), POST_DETAIL_OPTIONS[pergola.postStyle])}
        {number('beamWidth', 'Beam width', 0.08, 0.3)}
        {number('beamHeight', 'Beam height', 0.12, 0.4)}
        <ToggleControl label="Knee braces" checked={pergola.braces} onChange={(braces) => update({ braces })} />
        {pergola.braces && select('braceStyle', 'Brace style', pergola.braceStyle, [
          { value: 'diagonal', label: 'Diagonal' }, { value: 'arched', label: 'Arched' },
          { value: 'swept', label: 'Swept' }, { value: 'curved-bracket', label: 'Curved bracket' },
        ])}
        {pergola.braces && <>
          {pergola.braceStyle === 'curved-bracket' && number('braceCurve', 'Bracket curve', 0.15, 0.85, 0.05)}
          {number('braceThickness', 'Brace thickness', 0.04, 0.16)}
          {number('braceReach', 'Brace reach', 0.25, 0.9)}
          {number('braceDrop', 'Brace drop', 0.2, 0.9)}
        </>}
      </PanelSection>
      <PanelSection title="Details" defaultExpanded={false}>
        {select('archMode', 'Full-width arch', pergolaArchMode(pergola), [
          { value: 'none', label: 'None' }, { value: 'front', label: 'Front' },
          { value: 'back', label: 'Back' }, { value: 'both', label: 'Both' },
        ])}
        {pergolaArchMode(pergola) !== 'none' && <>
          {select('archStyle', 'Arch style', pergola.archStyle, [
            { value: 'segmental', label: 'Segmental' }, { value: 'rounded', label: 'Rounded' },
            { value: 'pointed', label: 'Pointed' },
          ])}
          {number('gableArchDrop', 'Arch drop', 0.2, 0.7)}
          {number('gableArchCurve', 'Arch rise', 0.05, 0.5)}
          {number('archDepth', 'Arch depth', 0.08, 0.35)}
        </>}
        {select('sideScreens', 'Side screens', pergola.sideScreens, [
          { value: 'none', label: 'None' }, { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' }, { value: 'both', label: 'Both' },
        ])}
        {pergola.sideScreens !== 'none' && <>
          {select('screenStyle', 'Screen style', pergola.screenStyle, [
            { value: 'horizontal-slats', label: 'Horizontal' }, { value: 'vertical-slats', label: 'Vertical' },
            { value: 'solid', label: 'Solid' },
          ])}
          {number('screenHeight', 'Screen height', 0.5, 2.5, 0.05)}
          {pergola.screenStyle !== 'solid' && <>
            {number('screenSlatWidth', 'Slat width', 0.04, 0.2)}
            {number('screenSlatGap', 'Slat gap', 0.02, 0.2)}
          </>}
        </>}
        {select('finish', 'Finish', pergola.finish, [
          { value: 'timber', label: 'Timber' }, { value: 'metal', label: 'Metal' },
        ])}
      </PanelSection>
    </div>
  </section>
}
