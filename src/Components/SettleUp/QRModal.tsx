import React, { useCallback, useState } from 'react';
import { formatCurrencyAmount, formatCurrencyAmountHumanized } from '../../Util/currency';
import { DEFAULT_CURRENCY_CODE } from '../../Model/settleUpFacade';
import QRCode from 'react-qr-code';
import qrcode from 'qrcode';
import qrIcon from './qr.png';
import './QRModal.css';
import { Modal } from '../Modal/Modal';

interface IQRModalProps {
	sepaQrCode: string;
	amount: string;
	bankAccount: string;
	currencyCode: string;
}

const QRModal = ({ sepaQrCode, amount, bankAccount, currencyCode }: IQRModalProps) => {
	const [open, setOpen] = useState(false);

	const downloadQRCode = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		const link = document.createElement("a");
		const qrCodeDataUrl = await qrcode.toDataURL(sepaQrCode);
		link.href = qrCodeDataUrl;
		link.download = `qr-${formatCurrencyAmount({ amount })}-${DEFAULT_CURRENCY_CODE}-${bankAccount}.png`;
		link.click();
	}, [amount, bankAccount, sepaQrCode]);

	return (
		<span className="QR">
			<button type="button" className="btn btn-light" onClick={() => setOpen(!open)}>
				<img className="qr-icon" src={qrIcon} alt='QR kód'/>
			</button>

			<Modal title={'QR platba'} open={open} setOpen={setOpen}>
				<button className="qr-code btn btn-link" onClick={downloadQRCode}>
					<QRCode value={sepaQrCode} size={256} />
				</button>
				<h4><small>Částka:</small> {formatCurrencyAmountHumanized({ amount, currencyCode, decimals: 2 })}</h4>
				<h4><small>Číslo účtu:</small> {bankAccount}</h4>
			</Modal>
		</span>
	);
};
export default QRModal;
