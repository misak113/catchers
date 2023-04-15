import React from 'react';
import { formatDateHumanized, formatTimeHumanized, formatWeekdayHumanized } from '../../Util/datetime';

interface IProps {
	startsAt: Date;
	className?: string;
	title?: string;
}

function FormattedDateTime(props: IProps) {
	return <span className={props.className} title={props.title}>
		{formatDateHumanized(props.startsAt)} <small>{formatWeekdayHumanized(props.startsAt)}</small>, {formatTimeHumanized(props.startsAt)}
	</span>;
}
export default FormattedDateTime;
