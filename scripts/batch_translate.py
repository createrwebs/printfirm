# -*- coding: utf-8 -*-
"""
Batch translation script to replace hardcoded Chinese in Admin and Frontend with Thai / English.
"""
import os
import re

REPLACEMENTS = {
    "admin/src/pages/OrdersPage.tsx": [
        ('title="订单流水"', 'title="ประวัติคำสั่งซื้อและการเงิน"'),
        ('description="充值订单、钱包流水与用量明细"', 'description="คำสั่งซื้อเติมเงิน ความเคลื่อนไหวในกระเป๋าเงิน และรายละเอียดการใช้งาน"'),
        ('<TabsTrigger value="orders">充值订单</TabsTrigger>', '<TabsTrigger value="orders">คำสั่งซื้อเติมเงิน</TabsTrigger>'),
        ('<TabsTrigger value="ledger">钱包流水</TabsTrigger>', '<TabsTrigger value="ledger">ความเคลื่อนไหวในกระเป๋า</TabsTrigger>'),
        ('<TabsTrigger value="usage">用量明细</TabsTrigger>', '<TabsTrigger value="usage">รายละเอียดการใช้งาน</TabsTrigger>'),
        ('<option value="">全部支付状态</option>', '<option value="">ทุกสถานะการชำระ</option>'),
        ('<option value="pending">待支付</option>', '<option value="pending">รอชำระเงิน</option>'),
        ('<option value="paid">已支付</option>', '<option value="paid">ชำระแล้ว</option>'),
        ('<option value="closed">已关闭</option>', '<option value="closed">ปิดแล้ว</option>'),
        ('placeholder="订单号 / 渠道号"', 'placeholder="เลขที่คำสั่งซื้อ / ช่องทาง"'),
        ('>筛选<', '>กรอง<'),
        ('<TableHead>订单号</TableHead>', '<TableHead>เลขที่คำสั่งซื้อ</TableHead>'),
        ('<TableHead>用户</TableHead>', '<TableHead>ผู้ใช้</TableHead>'),
        ('<TableHead>金额</TableHead>', '<TableHead>ยอดเงิน</TableHead>'),
        ('<TableHead>支付方式</TableHead>', '<TableHead>ช่องทางชำระเงิน</TableHead>'),
        ('<TableHead>状态</TableHead>', '<TableHead>สถานะ</TableHead>'),
        ('<TableHead>创建时间</TableHead>', '<TableHead>เวลาสร้าง</TableHead>'),
        ('<option value="">全部类型</option>', '<option value="">ทุกประเภท</option>'),
        ('<option value="topup">充值</option>', '<option value="topup">เติมเงิน</option>'),
        ('<option value="grant">赠送</option>', '<option value="grant">โบนัส</option>'),
        ('<option value="adjust">调账</option>', '<option value="adjust">ปรับยอดเงิน</option>'),
        ('<option value="freeze">冻结</option>', '<option value="freeze">ระงับชั่วคราว</option>'),
        ('<option value="unfreeze">解冻</option>', '<option value="unfreeze">ปลดระงับ</option>'),
        ('<option value="settle">结算</option>', '<option value="settle">หักชำระ</option>'),
        ('<option value="refund">退款</option>', '<option value="refund">คืนเงิน</option>'),
        ('<TableHead>变动</TableHead>', '<TableHead>การเปลี่ยนแปลง</TableHead>'),
        ('<TableHead>余额后</TableHead>', '<TableHead>ยอดคงเหลือหลังทำรายการ</TableHead>'),
        ('<TableHead>类型</TableHead>', '<TableHead>ประเภท</TableHead>'),
        ('<TableHead>关联</TableHead>', '<TableHead>การเชื่อมโยง</TableHead>'),
        ('<TableHead>备注</TableHead>', '<TableHead>หมายเหตุ</TableHead>'),
        ('<TableHead>时间</TableHead>', '<TableHead>เวลา</TableHead>'),
        ('placeholder="任务 ID"', 'placeholder="ID คิวงาน"'),
        ('<option value="">全部领域</option>', '<option value="">ทุกหมวดหมู่</option>'),
        ('<option value="kepu">科普</option>', '<option value="kepu">วิดีโอสั้น AI</option>'),
        ('<option value="drama">漫剧</option>', '<option value="drama">ละครสั้น AI</option>'),
        ('<option value="studio">工作室</option>', '<option value="studio">สตูดิโอ</option>'),
        ('<option value="">全部能力</option>', '<option value="">ทุกความสามารถ</option>'),
        ('<option value="llm">LLM 文本</option>', '<option value="llm">LLM ข้อความ</option>'),
        ('<option value="image">生图</option>', '<option value="image">สร้างภาพ</option>'),
        ('<option value="video">视频</option>', '<option value="video">สร้างวิดีโอ</option>'),
        ('<option value="tts">配音</option>', '<option value="tts">เสียงพากย์</option>'),
        ('placeholder="模型（如 seedance-2.5）"', 'placeholder="โมเดล (เช่น seedance-2.5)"'),
        ('<option value="">全部计费依据</option>', '<option value="">เกณฑ์การคิดค่าบริการทั้งหมด</option>'),
        ('<option value="estimate">估算</option>', '<option value="estimate">ประมาณการ</option>'),
        ('<option value="upstream">实测</option>', '<option value="upstream">วัดจริง</option>'),
        ('<option value="upstream_usage">实测(token)</option>', '<option value="upstream_usage">วัดจริง (Token)</option>'),
        ('<option value="upstream_cost">实测(费用)</option>', '<option value="upstream_cost">วัดจริง (ค่าใช้จ่าย)</option>'),
    ],
    "admin/src/pages/TeamsPage.tsx": [
        ('title="团队管理"', 'title="จัดการทีม"'),
        ('description="搜索团队，查看成员配额与空间统计"', 'description="ค้นหาทีม ตรวจสอบโควตาสมาชิกและสถิติการใช้งาน"'),
        ('placeholder="团队名 / 编码"', 'placeholder="ชื่อทีม / รหัสทีม"'),
        ('>筛选<', '>กรอง<'),
        ('<TableHead>团队</TableHead>', '<TableHead>ทีม</TableHead>'),
        ('<TableHead>所有者</TableHead>', '<TableHead>เจ้าของทีม</TableHead>'),
        ('<TableHead>成员</TableHead>', '<TableHead>สมาชิก</TableHead>'),
        ('<TableHead>项目</TableHead>', '<TableHead>โปรเจกต์</TableHead>'),
        ('<TableHead>创建时间</TableHead>', '<TableHead>เวลาสร้าง</TableHead>'),
        ('>详情<', '>รายละเอียด<'),
    ],
    "admin/src/pages/FinanceListPage.tsx": [
        ('title="财务列表"', 'title="บัญชีการเงิน"'),
        ('description="充值订单、调账记录与平台流水"', 'description="คำสั่งซื้อเติมเงิน บันทึกการปรับยอด และประวัติการเงินทั้งระบบ"'),
        ('<TableHead>订单号</TableHead>', '<TableHead>เลขที่คำสั่งซื้อ</TableHead>'),
        ('<TableHead>用户</TableHead>', '<TableHead>ผู้ใช้</TableHead>'),
        ('<TableHead>金额</TableHead>', '<TableHead>ยอดเงิน</TableHead>'),
        ('<TableHead>状态</TableHead>', '<TableHead>สถานะ</TableHead>'),
        ('<TableHead>时间</TableHead>', '<TableHead>เวลา</TableHead>'),
    ],
    "admin/src/pages/AdjustRecordsPage.tsx": [
        ('title="手动调账"', 'title="ปรับยอดเงินด้วยตนเอง"'),
        ('description="管理端调账历史记录"', 'description="ประวัติการปรับยอดเงินโดยผู้ดูแลระบบ"'),
        ('<TableHead>用户</TableHead>', '<TableHead>ผู้ใช้</TableHead>'),
        ('<TableHead>金额</TableHead>', '<TableHead>ยอดเงิน</TableHead>'),
        ('<TableHead>原因</TableHead>', '<TableHead>เหตุผล</TableHead>'),
        ('<TableHead>操作人</TableHead>', '<TableHead>ผู้ดำเนินการ</TableHead>'),
        ('<TableHead>时间</TableHead>', '<TableHead>เวลา</TableHead>'),
    ],
    "admin/src/pages/WorksPage.tsx": [
        ('title="作品审核"', 'title="ตรวจสอบผลงาน"'),
        ('description="审核用户公开的作品，管理展示状态"', 'description="ตรวจสอบและจัดการสถานะการแสดงผลงานของผู้ใช้"'),
        ('<TableHead>作品</TableHead>', '<TableHead>ผลงาน</TableHead>'),
        ('<TableHead>作者</TableHead>', '<TableHead>ผู้สร้าง</TableHead>'),
        ('<TableHead>状态</TableHead>', '<TableHead>สถานะ</TableHead>'),
        ('<TableHead>公开性</TableHead>', '<TableHead>การเปิดเผย</TableHead>'),
        ('<TableHead>时间</TableHead>', '<TableHead>เวลา</TableHead>'),
        ('>通过<', '>อนุมัติ<'),
        ('>拒绝<', '>ปฏิเสธ<'),
    ],
    "admin/src/pages/QueuesPage.tsx": [
        ('title="任务中心"', 'title="ศูนย์คิวงาน"'),
        ('description="全平台生成任务队列：状态、租约与重试"', 'description="คิวงานประมวลผลทั้งระบบ: สถานะ, การเช่าคิว และการลองใหม่"'),
        ('<TableHead>任务 ID</TableHead>', '<TableHead>ID งาน</TableHead>'),
        ('<TableHead>类型</TableHead>', '<TableHead>ประเภท</TableHead>'),
        ('<TableHead>状态</TableHead>', '<TableHead>สถานะ</TableHead>'),
        ('<TableHead>重试</TableHead>', '<TableHead>ลองใหม่</TableHead>'),
        ('<TableHead>创建时间</TableHead>', '<TableHead>เวลาสร้าง</TableHead>'),
    ],
    "admin/src/pages/TemplatesPage.tsx": [
        ('title="模板管理"', 'title="จัดการแม่แบบ"'),
        ('description="管理科普与短剧预设模板"', 'description="จัดการแม่แบบวิดีโอและละครสั้น"'),
        ('>新建模板<', '>สร้างแม่แบบใหม่<'),
        ('<TableHead>模板名称</TableHead>', '<TableHead>ชื่อแม่แบบ</TableHead>'),
        ('<TableHead>分类</TableHead>', '<TableHead>หมวดหมู่</TableHead>'),
        ('<TableHead>状态</TableHead>', '<TableHead>สถานะ</TableHead>'),
        ('<TableHead>操作</TableHead>', '<TableHead>การจัดการ</TableHead>'),
        ('>编辑<', '>แก้ไข<'),
        ('>删除<', '>ลบ<'),
    ],
    "admin/src/pages/SettingsPage.tsx": [
        ('title="系统设置"', 'title="ตั้งค่าระบบ"'),
        ('description="模型路由、支付配置与系统参数"', 'description="เส้นทางโมเดล AI, การตั้งค่าการชำระเงิน และพารามิเตอร์ระบบ"'),
    ],
    "admin/src/pages/drama/DramaProjectsPage.tsx": [
        ('title="漫剧项目"', 'title="โปรเจกต์ละครสั้น"'),
        ('description="全站漫剧项目：状态、集数、资产与进度"', 'description="โปรเจกต์ละครสั้นทั้งระบบ: สถานะ, จำนวนตอน, แอสเซท และความคืบหน้า"'),
        ('placeholder="标题 / 介绍"', 'placeholder="ชื่อเรื่อง / คำอธิบาย"'),
        ('<TableHead>标题</TableHead>', '<TableHead>ชื่อเรื่อง</TableHead>'),
        ('<TableHead>用户</TableHead>', '<TableHead>ผู้ใช้</TableHead>'),
        ('<TableHead>工作流</TableHead>', '<TableHead>เวิร์กโฟลว์</TableHead>'),
        ('<TableHead>集数</TableHead>', '<TableHead>จำนวนตอน</TableHead>'),
        ('<TableHead>状态</TableHead>', '<TableHead>สถานะ</TableHead>'),
        ('<TableHead>创建时间</TableHead>', '<TableHead>เวลาสร้าง</TableHead>'),
        ('>详情<', '>รายละเอียด<'),
    ],
    "admin/src/pages/drama/DramaAssetsPage.tsx": [
        ('title="资产库"', 'title="คลังแอสเซท"'),
        ('description="全站漫剧资产：角色、场景、道具等，可按项目与用户筛选"', 'description="คลังแอสเซทละครสั้น: ตัวละคร, ฉาก, อุปกรณ์ ฯลฯ คัดกรองตามโปรเจกต์และผู้ใช้"'),
        ('placeholder="名称 / derive_id"', 'placeholder="ชื่อ / derive_id"'),
        ('<option value="">全部类型</option>', '<option value="">ทุกประเภท</option>'),
        ('<option value="character">角色</option>', '<option value="character">ตัวละคร</option>'),
        ('<option value="scene">场景</option>', '<option value="scene">ฉาก</option>'),
        ('<option value="prop">道具</option>', '<option value="prop">อุปกรณ์</option>'),
        ('<option value="material">素材</option>', '<option value="material">ฟุตเทจ/素材</option>'),
        ('<option value="none">未分类</option>', '<option value="none">ไม่ระบุหมวด</option>'),
        ('<option value="">全部生成状态</option>', '<option value="">ทุกสถานะการสร้าง</option>'),
        ('<TableHead>名称</TableHead>', '<TableHead>ชื่อแอสเซท</TableHead>'),
        ('<TableHead>类型</TableHead>', '<TableHead>ประเภท</TableHead>'),
        ('<TableHead>项目</TableHead>', '<TableHead>โปรเจกต์</TableHead>'),
        ('<TableHead>用户</TableHead>', '<TableHead>ผู้ใช้</TableHead>'),
        ('<TableHead>生成状态</TableHead>', '<TableHead>สถานะสร้าง</TableHead>'),
        ('<TableHead>预览</TableHead>', '<TableHead>ตัวอย่าง</TableHead>'),
        ('<TableHead>时间</TableHead>', '<TableHead>เวลา</TableHead>'),
        ('>详情<', '>รายละเอียด<'),
    ],
    "admin/src/pages/drama/DramaEpisodesPage.tsx": [
        ('title="分集管理"', 'title="จัดการตอน (Episodes)"'),
        ('description="全站漫剧分集：剧本、分镜进度与合成状态"', 'description="ตอนของละครสั้นทั้งระบบ: บทละคร, ความคืบหน้าสตอรี่บอร์ด และสถานะการรวมคลิป"'),
        ('placeholder="标题 / 内容"', 'placeholder="ชื่อตอน / เนื้อหา"'),
        ('<TableHead>集号</TableHead>', '<TableHead>ตอนที่</TableHead>'),
        ('<TableHead>标题</TableHead>', '<TableHead>ชื่อตอน</TableHead>'),
        ('<TableHead>所属项目</TableHead>', '<TableHead>โปรเจกต์</TableHead>'),
        ('<TableHead>用户</TableHead>', '<TableHead>ผู้ใช้</TableHead>'),
        ('<TableHead>分镜数</TableHead>', '<TableHead>จำนวนช็อต</TableHead>'),
        ('<TableHead>时长</TableHead>', '<TableHead>ความยาว</TableHead>'),
        ('<TableHead>合成状态</TableHead>', '<TableHead>สถานะการรวมคลิป</TableHead>'),
        ('<TableHead>更新时间</TableHead>', '<TableHead>เวลาอัปเดต</TableHead>'),
        ('>详情<', '>รายละเอียด<'),
    ],
    "admin/src/pages/drama/DramaFragmentsPage.tsx": [
        ('title="分镜管理"', 'title="จัดการสตอรี่บอร์ด (Fragments)"'),
        ('description="全站漫剧分镜：提示词、绑定资产与生成结果"', 'description="สตอรี่บอร์ดละครสั้นทั้งระบบ: พร้อมท์, การผูกแอสเซท และผลลัพธ์การสร้าง"'),
        ('<TableHead>分镜号</TableHead>', '<TableHead>ช็อตที่</TableHead>'),
        ('<TableHead>分集</TableHead>', '<TableHead>ตอน</TableHead>'),
        ('<TableHead>项目</TableHead>', '<TableHead>โปรเจกต์</TableHead>'),
        ('<TableHead>描述</TableHead>', '<TableHead>คำบรรยาย</TableHead>'),
        ('<TableHead>时长</TableHead>', '<TableHead>ความยาว</TableHead>'),
        ('<TableHead>视频状态</TableHead>', '<TableHead>สถานะวิดีโอ</TableHead>'),
        ('<TableHead>更新时间</TableHead>', '<TableHead>เวลาอัปเดต</TableHead>'),
        ('>详情<', '>รายละเอียด<'),
    ],
    "frontend/src/pages/drama/AssetsStep.tsx": [
        ("{ key: 'character', label: '角色' }", "{ key: 'character', label: 'ตัวละคร' }"),
        ("{ key: 'scene', label: '场景' }", "{ key: 'scene', label: 'ฉาก' }"),
        ("{ key: 'prop', label: '道具' }", "{ key: 'prop', label: 'อุปกรณ์' }"),
        ("{ key: 'voice' as const, label: '音色' }", "{ key: 'voice' as const, label: 'โทนเสียง' }"),
        (">批量生图<", ">สร้างภาพทั้งหมด<"),
        (">新建资产<", ">สร้างแอสเซทใหม่<"),
        (">导入全局资产<", ">นำเข้าจากคลังกลาง<"),
        (">重新抽取<", ">สกัดข้อมูลใหม่<"),
        (">抽取资产<", ">สกัดแอสเซทจากบท<"),
    ],
    "frontend/src/pages/drama/OutlineStep.tsx": [
        (">生成大纲<", ">สร้างพล็อตเรื่อง<"),
        (">重新生成<", ">สร้างใหม่<"),
        (">批量生成分集剧本<", ">สร้างบทละครทุกตอน<"),
        (">生成分集剧本<", ">สร้างบทละครประจำตอน<"),
        (">编辑大纲<", ">แก้ไขพล็อตเรื่อง<"),
        (">剧本设置<", ">ตั้งค่าบทละคร<"),
        (">风格画风<", ">สไตล์ภาพ<"),
    ],
    "frontend/src/pages/drama/OutlineEpisodePanel.tsx": [
        (">生成剧本<", ">สร้างบทละคร<"),
        (">重新生成剧本<", ">สร้างบทละครใหม่<"),
        (">进入制作<", ">เข้าสู่ขั้นตอนการผลิต<"),
        (">编辑分集<", ">แก้ไขตอน<"),
        (">删除分集<", ">ลบตอนนี้<"),
        (">添加分集<", ">เพิ่มตอนใหม่<"),
    ],
    "frontend/src/pages/drama/EpisodeEditHeaderControls.tsx": [
        (">画幅 / 清晰度<", ">สัดส่วน / ความละเอียด<"),
        (">视频风格<", ">สไตล์วิดีโอ<"),
        (">字幕设置<", ">ตั้งค่าซับไตเติล<"),
        (">人物介绍<", ">แนะนำตัวละคร<"),
        (">AI 模型<", ">โมเดล AI<"),
        (">首尾帧衔接<", ">เชื่อมโยงเฟรมแรก-ท้าย<"),
    ],
    "frontend/src/pages/studio/CreateProjectPage.tsx": [
        ('title="创建短视频项目"', 'title="สร้างโปรเจกต์วิดีโอสั้น"'),
        ('placeholder="输入一个创意想法，例如：为什么海水是咸的？"', 'placeholder="ใส่ไอเดีย เช่น ทำไมน้ำทะเลถึงเค็ม?"'),
        ('>开始生成<', '>เริ่มสร้าง<'),
        ('>下一步<', '>ขั้นตอนถัดไป<'),
    ],
    "frontend/src/pages/studio/StoryboardPage.tsx": [
        ('>生成全部画面<', '>สร้างภาพทุกช็อต<'),
        ('>全片配音<', '>สร้างเสียงพากย์ทั้งเรื่อง<'),
        ('>合成导出<', '>รวมคลิปและส่งออก<'),
        ('>添加镜头<', '>เพิ่มช็อตใหม่<'),
    ],
    "frontend/src/pages/GenerationPage.tsx": [
        ('>开始生成<', '>เริ่มประมวลผล<'),
        ('>下载视频<', '>ดาวน์โหลดวิดีโอ<'),
        ('>重新制作<', '>สร้างใหม่<'),
    ],
}

def main():
    total_replaced = 0
    for rel_path, pairs in REPLACEMENTS.items():
        if not os.path.exists(rel_path):
            print(f"File not found: {rel_path}")
            continue
        with open(rel_path, 'r', encoding='utf-8') as f:
            content = f.read()
        file_replaced = 0
        for src, dst in pairs:
            if src in content:
                count = content.count(src)
                content = content.replace(src, dst)
                file_replaced += count
        if file_replaced > 0:
            with open(rel_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Replaced {file_replaced:3d} in {rel_path}")
            total_replaced += file_replaced
        else:
            print(f"No match for {rel_path}")
    print(f"\nTotal replacements: {total_replaced}")

if __name__ == '__main__':
    main()
