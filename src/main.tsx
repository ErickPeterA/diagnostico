import { useEffect,useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Home,LayoutDashboard,ClipboardList,BarChart3,Users,Trophy,Sparkles,Settings,Bell,Search,Building2,Play,ChevronsUpDown,FileText,ListChecks } from 'lucide-react';
import { Admin } from './Admin';
import { InterviewFlow } from './InterviewFlow';
import { Analysis } from './Analysis';
import { api } from './api';
import { CompanyHub,type Company } from './CompanyHub';
import { ActionPlans } from './ActionPlans';
import './styles.css';
import './schedule.css';
import './group-ranking.css';
import './layout-fixes.css';

type Diagnostic={id:string;name:string;starts_on?:string;ends_on?:string};

const nav=[['Home',Home],['Visão geral',LayoutDashboard],['Kickoff / Cadastro',Settings],['Entrevistas',ClipboardList],['Dados',BarChart3],['Compilação geral',BarChart3],['Resultados de lideranças',Users],['Rankings',Trophy],['Pontos fortes e atenção',Sparkles],['Plano de Ação',ListChecks]] as const;
const adminPages=['Home','Kickoff / Cadastro','Entrevistas'];

function App(){
 const [company,setCompany]=useState<Company>(),[diagnosticId,setDiagnosticId]=useState<string>(),[diagnostics,setDiagnostics]=useState<Diagnostic[]>([]),[page,setPage]=useState('Home'),[interview,setInterview]=useState<string>(),[dbStatus,setDbStatus]=useState<'checking'|'ok'|'offline'>('checking'),[reminders,setReminders]=useState<any[]>([]),[notificationsOpen,setNotificationsOpen]=useState(false);
 useEffect(()=>{fetch('/health').then(r=>setDbStatus(r.ok?'ok':'offline')).catch(()=>setDbStatus('offline'))},[]);
 useEffect(()=>{if(!company){setDiagnostics([]);return}api<Diagnostic[]>(`/diagnostics?companyId=${company.id}`).then(setDiagnostics).catch(()=>setDiagnostics([]))},[company?.id,diagnosticId]);
 useEffect(()=>{if(!diagnosticId){setReminders([]);return}const load=()=>api<any[]>(`/diagnostics/${diagnosticId}/interviews`).then(rows=>{const now=Date.now();setReminders(rows.filter(x=>x.status==='not_started'&&x.scheduled_at&&new Date(x.scheduled_at).getTime()>=now&&new Date(x.scheduled_at).getTime()-now<=3600000))}).catch(()=>setReminders([]));load();const timer=window.setInterval(load,60000);return()=>window.clearInterval(timer)},[diagnosticId]);
 const diagnostic=diagnostics.find(x=>x.id===diagnosticId);
 if(interview)return <InterviewFlow id={interview} onExit={()=>setInterview(undefined)}/>;
 if(!company)return <CompanyHub dbStatus={dbStatus} onOpen={value=>{setCompany(value);setDiagnosticId(undefined);setPage('Home')}}/>;
 const leave=()=>{setCompany(undefined);setDiagnosticId(undefined)},selectDiagnostic=(id:string)=>{setDiagnosticId(id);setPage('Kickoff / Cadastro')};
 const visibleNav=diagnosticId?nav:nav.slice(0,1);
 return <div className="shell"><aside><div className="brand"><div className="brandmark">C</div><div><strong>Clima</strong><span>Diagnóstico organizacional</span></div></div><button className="company-switch" onClick={leave}><div className="company-mini"><Building2/></div><div><small>EMPRESA ATUAL</small><strong>{company.trade_name||company.name}</strong></div><ChevronsUpDown/></button><nav>{visibleNav.map(([label,Icon],i)=><button className={page===label?'active':''} onClick={()=>setPage(label)} key={label}><Icon size={16}/><span>{label}</span>{i===3&&diagnosticId&&<em>•</em>}</button>)}</nav><div className="aside-foot"><div className="avatar">AD</div><div><strong>Admin</strong><span>Perfil</span></div></div></aside><main><header><div><span className="header-company">{company.name}</span><h1>{page}</h1><p>{diagnostic?`Dados e configurações de ${diagnostic.name}`:'Selecione um diagnóstico para continuar'}</p></div><div className="head-actions"><div className={`current-diagnostic ${diagnostic?'':'missing'}`}><FileText/><span><small>DIAGNÓSTICO ATUAL</small><b>{diagnostic?.name||'Nenhum selecionado'}</b></span></div><div className={`db ${dbStatus}`}><i/>{dbStatus==='ok'?'Banco conectado':dbStatus==='checking'?'Verificando banco':'Configure o banco'}</div><button className="iconbtn" aria-label="Buscar"><Search size={19}/></button><div className="notification-wrap"><button className={reminders.length?'iconbtn has-notification':'iconbtn'} aria-label="Notificações" onClick={()=>setNotificationsOpen(!notificationsOpen)}><Bell size={19}/>{reminders.length>0&&<b/>}</button>{notificationsOpen&&<div className="notification-popover"><h3>Notificações</h3>{!reminders.length?<p>Nenhuma entrevista para a próxima hora.</p>:reminders.map(x=><button key={x.id} onClick={()=>{setNotificationsOpen(false);setInterview(x.id)}}><Bell/><span><strong>Entrevista em breve</strong><small>{x.conductor_name} · {new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(x.scheduled_at))}</small></span></button>)}</div>}</div><button className="primary" disabled={!diagnosticId} onClick={()=>setPage('Entrevistas')}><Play size={17} fill="currentColor"/> Aplicar entrevista</button></div></header><section className="content">{adminPages.includes(page)?<Admin page={page} companyId={company.id} selectedDiagnosticId={diagnosticId} onDiagnosticChange={selectDiagnostic} onNavigate={setPage} onInterview={id=>id?setInterview(id):setPage('Entrevistas')}/>:page==='Plano de Ação'&&diagnosticId?<ActionPlans companyId={company.id} diagnosticId={diagnosticId}/>:diagnosticId?<Analysis page={page} companyId={company.id} selectedDiagnosticId={diagnosticId} onDiagnosticChange={selectDiagnostic}/>:null}</section></main></div>
}

createRoot(document.getElementById('root')!).render(<App/>);
