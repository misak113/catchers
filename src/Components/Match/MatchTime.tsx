import React from 'react';
import moment from 'moment';

interface IProps {
	startsAt: Date;
}

function MatchTime(props: IProps) {
	return <>
		{moment(props.startsAt).format('LT')}
	</>;
}
export default MatchTime;
