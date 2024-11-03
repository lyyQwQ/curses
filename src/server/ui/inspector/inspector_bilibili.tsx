import { Bilibili_State } from "@/server/services/bilibili/schema";
import { FC } from "react";
import { SiBilibili } from "react-icons/si";
import { useSnapshot } from "valtio";
import Inspector from "./components";
import { InputCheckbox, InputMapObject, InputNetworkStatus, InputText, InputTextSource } from "./components/input";
import { useTranslation } from "react-i18next";
import ServiceButton from "../service-button";
import { toast } from "react-toastify";

const Inspector_Bilibili: FC = () => {
  const {t} = useTranslation();
  const pr = useSnapshot(window.ApiServer.state.services.bilibili.data);
  const state = useSnapshot(window.ApiServer.bilibili.state);
  
  console.info('Inspector_Bilibili rendered, state:', state);

  const up = <K extends keyof Bilibili_State>(key: K, v: Bilibili_State[K]) => {
    console.info('Updating bilibili state:', key, v);
    window.ApiServer.patchService("bilibili", s => s.data[key] = v);
  }

  const handleLogin = () => {
    console.info('Login button clicked');
    window.ApiServer.bilibili.login();
  };

  const handleLogout = () => {
    console.info('Logout button clicked');
    window.ApiServer.bilibili.logout();
  };

  return <Inspector.Body>
    <Inspector.Header><SiBilibili/> {t('bilibili.title')}</Inspector.Header>
    <Inspector.Content>
      <Inspector.Description>{t('bilibili.desc')}</Inspector.Description>
      
      {/* 基础设置 */}
      <InputCheckbox label="common.field_action_bar" value={pr.showActionButton} onChange={e => up("showActionButton", e)} />
      <InputCheckbox label="common.field_auto_start" value={pr.autoStart} onChange={e => up("autoStart", e)} />
      
      {/* 连接状态 */}
      <InputNetworkStatus label="common.field_connection_status" value={state.status} />
      
      {/* 用户信息 */}
      {state.userInfo && (
        <div className="flex items-center space-x-2">
          <img src={pr.avatar} className="w-8 h-8 rounded-full" />
          <span className="font-medium">{pr.username}</span>
        </div>
      )}
      
      {/* 登录/登出按钮 */}
      <ServiceButton
        showError
        errorLabel={t('bilibili.btn_login_error')}
        stopLabel={t('common.btn_logout')}
        startLabel={t('common.btn_login')}
        status={state.status}
        onStart={handleLogin}
        onStop={handleLogout}
      />

      {/* 直播间设置 */}
      <Inspector.SubHeader>{t('bilibili.section_room')}</Inspector.SubHeader>
      <InputText label="bilibili.field_room_id" value={pr.roomId} onChange={e => up("roomId", e.target.value)} />
      <InputText label="bilibili.field_room_title" value={pr.roomTitle} onChange={e => up("roomTitle", e.target.value)} />

      {/* 聊天设置 */}
      <Inspector.SubHeader>{t('bilibili.section_chat')}</Inspector.SubHeader>
      <InputCheckbox label="common.field_enable" value={pr.chatEnable} onChange={e => up("chatEnable", e)} />
      <InputCheckbox label="bilibili.field_enable_chat" value={pr.chatPostEnable} onChange={e => up("chatPostEnable", e)} />
      <InputCheckbox label="bilibili.field_post_only_when_streaming" value={pr.chatPostLive} onChange={e => up("chatPostLive", e)} />
      <InputTextSource label="common.field_text_source" value={pr.chatPostSource} onChange={e => up("chatPostSource", e)} />
      <InputCheckbox label="common.field_use_keyboard_input" value={pr.chatPostInput} onChange={e => up("chatPostInput", e)} />
      <InputText type="number" label="common.field_send_delay" value={pr.chatSendDelay} onChange={e => up("chatSendDelay", e.target.value)} />

      {/* GPT设置 */}
      <Inspector.SubHeader>{t('bilibili.section_gpt')}</Inspector.SubHeader>
      <InputCheckbox label="common.field_enable" value={pr.gptEnable} onChange={e => up("gptEnable", e)} />
      <InputCheckbox label="bilibili.field_gpt_auto_reply" value={pr.gptAutoReply} onChange={e => up("gptAutoReply", e)} />
      <InputText type="password" label="bilibili.field_gpt_token" value={pr.gptToken} onChange={e => up("gptToken", e.target.value)} />

      {/* 自动回复设置 */}
      <Inspector.SubHeader>{t('bilibili.section_auto_reply')}</Inspector.SubHeader>
      <InputCheckbox label="common.field_enable" value={pr.autoReplyEnable} onChange={e => up("autoReplyEnable", e)} />
      <InputMapObject 
        label="bilibili.field_auto_reply_rules"
        value={pr.autoReplyRules}
        onChange={v => up("autoReplyRules", v)}
        keyPlaceholder={t('bilibili.auto_reply_trigger')}
        valuePlaceholder={t('bilibili.auto_reply_response')}
      />
    </Inspector.Content>
  </Inspector.Body>
} 

export default Inspector_Bilibili; 