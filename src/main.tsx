import { useEffect,useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LayoutDashboard,ClipboardList,MessageSquareText,BarChart3,Users,Trophy,Sparkles,Settings,Bell,Search,Building2,Play,ChevronDown } from 'lucide-react';
import { Admin } from './Admin';
import { InterviewFlow } from './InterviewFlow';
import { Analysis } from './Analysis';
import './styles.css';

const nav=[['Visão geral',LayoutDashboard],['Empresas',Building2],['Diagnósticos',ClipboardList],['Kickoff / Cadastro',Settings],['Entrevistas',ClipboardList],['Dados',BarChart3],['Compilação geral',BarChart3],['Compilação de lideranças',Users],['Compilação de diretoria',Users],['Rankings',Trophy],['LCOD',MessageSquareText],['Pontos fortes e atenção',Sparkles]] as const;
const adminPages=['Empresas','Diagnósticos','Kickoff / Cadastro','Entrevistas'];

function App(){
 const [page,setPage]=useState('Visão geral'),[interview,setInterview]=useState<string>(),[dbStatus,setDbStatus]=useState<'checking'|'ok'|'offline'>('checking');
 useEffect(()=>{fetch('/health').then(r=>setDbStatus(r.ok?'ok':'offline')).catch(()=>setDbStatus('offline'))},[]);
 if(interview)return <InterviewFlow id={interview} onExit={()=>setInterview(undefined)}/>;
 return <div className="shell"><aside><div className="brand"><div className="brandmark">C</div><div><strong>Clima</strong><span>Diagnóstico organizacional</span></div></div><nav>{nav.map(([label,Icon],i)=><button className={page===label?'active':''} onClick={()=>setPage(label)} key={label}><Icon size={18}/><span>{label}</span>{i===4&&<em>•</em>}</button>)}</nav><div className="aside-foot"><div className="avatar">AD</div><div><strong>Administração</strong><span>Ambiente seguro</span></div><ChevronDown size={16}/></div></aside><main><header><div><h1>{page}</h1><p>{page==='Visão geral'?'Resultados consolidados do diagnóstico':'Configuração, coleta e análise organizacional'}</p></div><div className="head-actions"><div className={`db ${dbStatus}`}><i/>{dbStatus==='ok'?'Banco conectado':dbStatus==='checking'?'Verificando banco':'Configure o banco'}</div><button className="iconbtn" aria-label="Buscar"><Search size={19}/></button><button className="iconbtn" aria-label="Notificações"><Bell size={19}/></button><button className="primary" onClick={()=>setPage('Entrevistas')}><Play size={17} fill="currentColor"/> Aplicar entrevista</button></div></header><section className="content">{adminPages.includes(page)?<Admin page={page} onNavigate={setPage} onInterview={id=>id?setInterview(id):setPage('Entrevistas')}/>:<Analysis page={page}/>}</section></main></div>
}

createRoot(document.getElementById('root')!).render(<App/>);
