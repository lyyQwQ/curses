import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { FC, useEffect } from "react";
import { useSnapshot } from "valtio";
import Modal from "./Modal";
import { useTranslation } from "react-i18next";

enum QRCodeState {
  Success = 0,
  Expired = 86038,
  WaitingScan = 86101,
  WaitingConfirm = 86090,
}

export const BilibiliLoginModal: FC = () => {
  const {t} = useTranslation();
  const modal = useModal();
  const state = useSnapshot(window.ApiServer.bilibili.state);

  useEffect(() => {
    // 当登录成功时关闭弹窗
    if(state.status === 'connected') {
      modal.hide();
    }
  }, [state.status]);

  const getStatusText = () => {
    switch(state.qrcodeStatus) {
      case QRCodeState.WaitingConfirm:
        return t('bilibili.login_scanned');
      case QRCodeState.Expired:
        return t('bilibili.login_expired');
      default:
        return t('bilibili.login_scan_tip');
    }
  }

  const handleRefresh = () => {
    window.ApiServer.bilibili.login();
  }

  return <Modal.Body>
    <Modal.Header>{t('bilibili.login_title')}</Modal.Header>
    <Modal.Content>
      <div className="p-4 flex flex-col items-center space-y-4">
        <div className="text-sm opacity-70">{getStatusText()}</div>
        
        {state.qrcodeStatus === QRCodeState.Expired ? (
          <button 
            className="btn btn-primary btn-sm"
            onClick={handleRefresh}
          >
            {t('bilibili.login_refresh')}
          </button>
        ) : (
          state.qrcodeUrl && (
            <img 
              src={state.qrcodeUrl}
              alt="Bilibili Login QR Code"
              className="w-48 h-48 border-2 border-primary/20 rounded-lg"
            />
          )
        )}
        
        <div className="text-xs opacity-50">{t('bilibili.login_scan_desc')}</div>
      </div>
    </Modal.Content>
  </Modal.Body>
}

NiceModal.register('bilibili-login', (props) => 
  <Modal.Base {...props}><BilibiliLoginModal /></Modal.Base>
); 