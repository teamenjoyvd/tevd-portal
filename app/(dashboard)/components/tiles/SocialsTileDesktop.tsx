import SocialsTile from './SocialsTile'

export default function SocialsTileDesktop({
  colSpan,
  rowSpan,
  style,
}: {
  colSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}) {
  return <SocialsTile colSpan={colSpan} mobileColSpan={12} rowSpan={rowSpan} style={style} />
}
