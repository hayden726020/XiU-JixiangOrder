export interface RealModeNoticeProps {
  note?: string;
}

export default function RealModeNotice({
  note = '金额与订单以下单结果为准',
}: RealModeNoticeProps) {
  return (
    <div className="student-real-banner" role="note">
      真实接口 · 菜单与拥挤来自公共服务 · {note}
    </div>
  );
}