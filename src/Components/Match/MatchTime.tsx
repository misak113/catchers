import React from 'react';
import { formatTimeHumanized } from '../../Util/datetime';

interface IProps {
	startsAt: Date;
}

function MatchTime(props: IProps) {
	return <>
		{formatTimeHumanized(props.startsAt)}
	</>;
}
export default MatchTime;
