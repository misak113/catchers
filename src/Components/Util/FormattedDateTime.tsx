import React from 'react';
import { formatDateHumanized, formatTimeHumanized, formatWeekdayHumanized } from '../../Util/datetime';

interface IProps {
	startsAt: Date;
}

function FormattedDateTime(props: IProps) {
	return <>
		{formatDateHumanized(props.startsAt)} <small>{formatWeekdayHumanized(props.startsAt)}</small>, {formatTimeHumanized(props.startsAt)}
	</>;
}
export default FormattedDateTime;
