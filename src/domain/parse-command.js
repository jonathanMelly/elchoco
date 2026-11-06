export function parseCommand(input){
    if(input.startsWith('/')) return {type:input.slice(1)};
    if(input.startsWith('@')){
	const [t,...m]=input.slice(1).split(' ');
	return {type:'private',target:t,text:m.join(' ')};
    }
    return {type:'global',text:input};}
