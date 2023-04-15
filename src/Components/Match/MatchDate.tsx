import React from 'react';
import { formatDateHumanized, formatWeekdayHumanized } from '../../Util/datetime';

interface IProps {
	startsAt: Date;
}

function MatchDate(props: IProps) {
	return <>
		{formatDateHumanized(props.startsAt)} <small>{formatWeekdayHumanized(props.startsAt)}</small>
	</>;
}
export default MatchDate;
