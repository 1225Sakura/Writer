import {
	useEffect,
	useRef,
	useState,
	useMemo,
	useCallback,
	Suspense,
	lazy,
} from "react";
import { useSettingsStore } from "@/store";
import {
	LinkIcon,
	Filter,
	Box,
	Grid2x2,
	ZoomIn,
	ZoomOut,
	RotateCcw,
	Eye,
	EyeOff,
	X,
	Users,
	MapPin,
	Swords,
	BookOpen,
	Globe,
	Scroll,
	ChevronRight,
	Maximize2,
	Minimize2,
	Sparkles,
	Info,
	Search,
	Focus,
	ExternalLink,
	Highlighter,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DURATION, EASE } from '@/components/shared/AnimationConfig'


const ForceGraph2D = lazy(() => import("react-force-graph-2d"));
const ForceGraph3D = lazy(() => import("react-force-graph-3d"));

interface GraphNode {
	id: string;
	name: string;
	type: EntityNodeType;
	color: string;
	val: number;
	description?: string;
	entityId: number;
}

interface GraphLink {
	source: string;
	target: string;
	type: string;
	color: string;
}

type EntityNodeType =
	| "character"
	| "item"
	| "location"
	| "faction"
	| "world"
	| "rule"
	| "outline"
	| "ifline";

interface NodeDetail {
	node: GraphNode;
	x: number;
	y: number;
}

interface HoverTooltipState {
	node: GraphNode;
	x: number;
	y: number;
}

interface ContextMenuState {
	node: GraphNode;
	x: number;
	y: number;
}

// Enhanced entity type config - unified with entityColor system
const ENTITY_TYPE_CONFIG: Record<
	EntityNodeType,
	{
		label: string;
		color: string;
		icon: typeof Users;
		glowColor: string;
		glowStrong: string;
		ringColor: string;
		size: number;
	}
> = {
	character: {
		label: "角色",
		color: "var(--color-character)",
		icon: Users,
		glowColor: "color-mix(in srgb, var(--color-character) 30%, transparent)",
		glowStrong: "color-mix(in srgb, var(--color-character) 60%, transparent)",
		ringColor: "color-mix(in srgb, var(--color-character) 20%, transparent)",
		size: 8,
	},
	item: {
		label: "物品",
		color: "var(--color-item)",
		icon: Scroll,
		glowColor: "color-mix(in srgb, var(--color-item) 30%, transparent)",
		glowStrong: "color-mix(in srgb, var(--color-item) 60%, transparent)",
		ringColor: "color-mix(in srgb, var(--color-item) 20%, transparent)",
		size: 6,
	},
	location: {
		label: "地点",
		color: "var(--color-location)",
		icon: MapPin,
		glowColor: "color-mix(in srgb, var(--color-location) 30%, transparent)",
		glowStrong: "color-mix(in srgb, var(--color-location) 60%, transparent)",
		ringColor: "color-mix(in srgb, var(--color-location) 20%, transparent)",
		size: 7,
	},
	faction: {
		label: "势力",
		color: "var(--color-faction)",
		icon: Swords,
		glowColor: "color-mix(in srgb, var(--color-faction) 30%, transparent)",
		glowStrong: "color-mix(in srgb, var(--color-faction) 60%, transparent)",
		ringColor: "color-mix(in srgb, var(--color-faction) 20%, transparent)",
		size: 7,
	},
	world: {
		label: "世界观",
		color: "var(--color-world)",
		icon: Globe,
		glowColor: "color-mix(in srgb, var(--color-world) 30%, transparent)",
		glowStrong: "color-mix(in srgb, var(--color-world) 60%, transparent)",
		ringColor: "color-mix(in srgb, var(--color-world) 20%, transparent)",
		size: 6,
	},
	rule: {
		label: "规则",
		color: "var(--color-rule)",
		icon: BookOpen,
		glowColor: "color-mix(in srgb, var(--color-rule) 30%, transparent)",
		glowStrong: "color-mix(in srgb, var(--color-rule) 60%, transparent)",
		ringColor: "color-mix(in srgb, var(--color-rule) 20%, transparent)",
		size: 5,
	},
	outline: {
		label: "大纲",
		color: "var(--color-outline)",
		icon: BookOpen,
		glowColor: "color-mix(in srgb, var(--color-outline) 30%, transparent)",
		glowStrong: "color-mix(in srgb, var(--color-outline) 60%, transparent)",
		ringColor: "color-mix(in srgb, var(--color-outline) 20%, transparent)",
		size: 5,
	},
	ifline: {
		label: "IF线",
		color: "var(--color-ifline)",
		icon: Scroll,
		glowColor: "color-mix(in srgb, var(--color-ifline) 30%, transparent)",
		glowStrong: "color-mix(in srgb, var(--color-ifline) 60%, transparent)",
		ringColor: "color-mix(in srgb, var(--color-ifline) 20%, transparent)",
		size: 6,
	},
};

// Unified relation colors - softer, more transparent to not overpower nodes
const RELATION_TYPE_COLORS: Record<string, string> = {
	family: "var(--color-location)",
	friend: "var(--color-outline)",
	enemy: "var(--color-danger)",
	master: "var(--color-item)",
	disciple: "var(--color-rule)",
	rival: "var(--color-character)",
	romantic: "var(--color-faction)",
	owns: "var(--color-item)",
	located_at: "var(--color-location)",
	belongs_to: "var(--color-faction)",
	other: "var(--text-tertiary)",
};

const RELATION_TYPE_LABELS: Record<string, string> = {
	family: "家人",
	friend: "朋友",
	enemy: "敌人",
	master: "师父",
	disciple: "徒弟",
	rival: "竞争",
	romantic: "恋人",
	owns: "拥有",
	located_at: "位于",
	belongs_to: "属于",
	other: "其他",
};

const PERFORMANCE_THRESHOLD = 100;

function useGraphData() {
	const {
		characters,
		items,
		locations,
		factions,
		worldSettings,
		rules,
		ifLines,
	} = useSettingsStore();

	return useMemo(() => {
		const nodes: GraphNode[] = [];
		const links: GraphLink[] = [];

		characters.forEach((char) => {
			nodes.push({
				id: `char_${char.id}`,
				name: char.name,
				type: "character",
				color: ENTITY_TYPE_CONFIG.character.color,
				val: Math.max(char.relationships.length + 1, 1),
				description: char.description || char.personality || "",
				entityId: char.id,
			});

			char.relationships.forEach((rel) => {
				const targetId = `char_${rel.targetId}`;
				if (nodes.some((n) => n.id === targetId)) {
					links.push({
						source: `char_${char.id}`,
						target: targetId,
						type: rel.type,
						color: RELATION_TYPE_COLORS[rel.type] || RELATION_TYPE_COLORS.other,
					});
				}
			});
		});

		items.forEach((item) => {
			nodes.push({
				id: `item_${item.id}`,
				name: item.name,
				type: "item",
				color: ENTITY_TYPE_CONFIG.item.color,
				val: 1,
				description: item.description || "",
				entityId: item.id,
			});
			if (item.owner) {
				const ownerChar = characters.find((c) => c.name === item.owner);
				if (ownerChar) {
					links.push({
						source: `char_${ownerChar.id}`,
						target: `item_${item.id}`,
						type: "owns",
						color: RELATION_TYPE_COLORS.owns,
					});
				}
			}
			if (item.location) {
				const loc = locations.find((l) => l.name === item.location);
				if (loc) {
					links.push({
						source: `item_${item.id}`,
						target: `loc_${loc.id}`,
						type: "located_at",
						color: RELATION_TYPE_COLORS.located_at,
					});
				}
			}
		});

		locations.forEach((loc) => {
			nodes.push({
				id: `loc_${loc.id}`,
				name: loc.name,
				type: "location",
				color: ENTITY_TYPE_CONFIG.location.color,
				val: 1,
				description: loc.description || "",
				entityId: loc.id,
			});
		});

		factions.forEach((fac) => {
			nodes.push({
				id: `fac_${fac.id}`,
				name: fac.name,
				type: "faction",
				color: ENTITY_TYPE_CONFIG.faction.color,
				val: 1,
				description: fac.description || "",
				entityId: fac.id,
			});
		});

		worldSettings.forEach((ws) => {
			nodes.push({
				id: `world_${ws.id}`,
				name: ws.name,
				type: "world",
				color: ENTITY_TYPE_CONFIG.world.color,
				val: 1,
				description: ws.description || "",
				entityId: ws.id,
			});
		});

		rules.forEach((rule) => {
			nodes.push({
				id: `rule_${rule.id}`,
				name: rule.name,
				type: "rule",
				color: ENTITY_TYPE_CONFIG.rule.color,
				val: 1,
				description: rule.description || "",
				entityId: rule.id,
			});
		});

		ifLines.forEach((ifl) => {
			nodes.push({
				id: `ifl_${ifl.id}`,
				name: ifl.title,
				type: "ifline",
				color: ENTITY_TYPE_CONFIG.ifline.color,
				val: 1,
				description: ifl.description || "",
				entityId: ifl.id,
			});
			if (ifl.linked_character_id) {
				links.push({
					source: `char_${ifl.linked_character_id}`,
					target: `ifl_${ifl.id}`,
					type: "other",
					color: RELATION_TYPE_COLORS.other,
				});
			}
		});

		return { nodes, links };
	}, [characters, items, locations, factions, worldSettings, rules, ifLines]);
}

function GraphFallback() {
	return (
		<div className="h-full flex items-center justify-center relative overflow-hidden rounded-lg" style={{ background: 'var(--ink-100)' }}>
			<div className="absolute inset-0 opacity-[0.04]">
				<div
					className="absolute inset-0"
					style={{
						backgroundImage:
							"radial-gradient(circle, var(--accent-primary) 0.5px, transparent 0.5px)",
						backgroundSize: "24px 24px",
					}}
				/>
			</div>
			<div className="text-center relative z-10">
				<div className="relative mx-auto mb-4 w-10 h-10">
					<div className="absolute inset-0 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
					<div
						className="absolute inset-1 rounded-full border-2 border-[var(--accent-primary)] border-b-transparent animate-spin"
						style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
					/>
					<Sparkles className="w-4 h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--accent-primary)]" />
				</div>
				<p className="text-xs font-medium" style={{ color: 'var(--paper-80)', opacity: 0.6 }}>
					加载图谱引擎...
				</p>
				<p className="text-[10px] mt-1" style={{ color: 'var(--paper-80)', opacity: 0.3 }}>
					正在构建节点关系
				</p>
			</div>
		</div>
	);
}

// Node hover tooltip with rich info following cursor
function NodeHoverTooltip({
	tooltip,
	containerRef,
}: {
	tooltip: HoverTooltipState;
	containerRef: React.RefObject<HTMLDivElement | null>;
}) {
	const config = ENTITY_TYPE_CONFIG[tooltip.node.type];
	const Icon = config.icon;

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.92 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.92 }}
			transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
			className="absolute z-30 rounded-xl p-3 min-w-[180px] max-w-[240px] pointer-events-none"
			style={{
				left: Math.min(
					tooltip.x + 16,
					(containerRef.current?.clientWidth || 800) - 260,
				),
				top: Math.max(tooltip.y - 12, 8),
				background: 'var(--paper-80)',
				border: `1px solid var(--border-default)`,
				boxShadow: `0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px var(--border-subtle), 0 0 40px ${config.glowColor}30, 0 4px 12px rgba(0,0,0,0.3)`,
				fontFamily: 'var(--font-sans)',
			}}
		>
			<div
				className="absolute top-0 left-3 right-3 h-px rounded-full"
				style={{
					background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
				}}
			/>
			<div className="flex items-center gap-2 mb-2">
				<div
					className="w-7 h-7 rounded-lg flex items-center justify-center"
					style={{
						background: `linear-gradient(135deg, ${config.color}20, ${config.color}08)`,
						boxShadow: `0 0 10px ${config.glowColor}30`,
					}}
				>
					<Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
				</div>
				<div className="min-w-0">
					<p className="text-sm font-semibold truncate" style={{ color: 'var(--ink-100)' }}>
						{tooltip.node.name}
					</p>
					<p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-90)', opacity: 0.6 }}>
						{config.label}
					</p>
				</div>
			</div>
			{tooltip.node.description && (
				<p className="text-[11px] leading-relaxed line-clamp-2 mb-2" style={{ color: 'var(--ink-90)', opacity: 0.75 }}>
					{tooltip.node.description}
				</p>
			)}
			<div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--ink-90)', opacity: 0.5 }}>
				<span className="flex items-center gap-1">
					<LinkIcon className="w-3 h-3" style={{ color: config.color }} />
					{tooltip.node.val - 1} 条关系
				</span>
				<span className="flex items-center gap-1">
					<Info className="w-3 h-3" style={{ color: config.color }} />
					ID: {tooltip.node.entityId}
				</span>
			</div>
		</motion.div>
	);
}

function NodeDetailPanel({
	detail,
	onClose,
}: {
	detail: NodeDetail;
	onClose: () => void;
}) {
	const config = ENTITY_TYPE_CONFIG[detail.node.type];
	const Icon = config.icon;

	return (
		<motion.div
			initial={{ opacity: 0, y: 8, scale: 0.96 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: 8, scale: 0.96 }}
			transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
			className="absolute z-20 rounded-xl p-3.5 min-w-[200px] max-w-[260px]"
			style={{
				left: Math.min(
					detail.x + 16,
					(typeof window !== "undefined" ? window.innerWidth : 800) - 280,
				),
				top: Math.max(detail.y - 16, 8),
				background: 'var(--paper-80)',
				border: "1px solid var(--border-default)",
				boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px var(--border-subtle), 0 0 30px ${config.glowColor}20`,
				fontFamily: 'var(--font-sans)',
			}}
		>
			<div
				className="absolute top-0 left-4 right-4 h-px rounded-full"
				style={{
					background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
				}}
			/>
			<div className="flex items-start justify-between mb-2.5">
				<div className="flex items-center gap-2.5">
					<div
						className="w-8 h-8 rounded-xl flex items-center justify-center relative"
						style={{
							background: `linear-gradient(135deg, ${config.color}20, ${config.color}08)`,
							boxShadow: `0 0 12px ${config.glowColor}30, inset 0 1px 0 var(--border-subtle)`,
						}}
					>
						<Icon className="w-4 h-4" style={{ color: config.color }} />
					</div>
					<div>
						<p className="text-sm font-semibold" style={{ color: 'var(--ink-100)' }}>
							{detail.node.name}
						</p>
						<p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-90)', opacity: 0.6 }}>
							{config.label}
						</p>
					</div>
				</div>
				<button
					onClick={onClose}
					className="p-1 rounded-lg hover:bg-[var(--hover-bg)] transition-all duration-200 flex-shrink-0 group"
				>
					<X className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
				</button>
			</div>
			{detail.node.description && (
				<p className="text-xs line-clamp-3 mb-2.5 leading-relaxed" style={{ color: 'var(--ink-90)', opacity: 0.75 }}>
					{detail.node.description}
				</p>
			)}
			<div className="flex items-center gap-1.5 text-[10px] pt-2 border-t border-[var(--border-subtle)]" style={{ color: 'var(--ink-90)', opacity: 0.5 }}>
				<LinkIcon className="w-3 h-3" style={{ color: config.color }} />
				<span>{detail.node.val - 1} 条关系</span>
			</div>
		</motion.div>
	);
}

function FilterControls({
	activeTypes,
	onToggleType,
	filterRelation,
	onSetRelationFilter,
	onZoomIn,
	onZoomOut,
	onResetView,
	searchQuery,
	onSearchChange,
	searchResults,
	onSelectResult,
}: {
	activeTypes: Set<EntityNodeType>;
	onToggleType: (type: EntityNodeType) => void;
	filterRelation: string;
	onSetRelationFilter: (type: string) => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onResetView: () => void;
	searchQuery: string;
	onSearchChange: (query: string) => void;
	searchResults: GraphNode[];
	onSelectResult: (node: GraphNode) => void;
}) {
	const [isExpanded, setIsExpanded] = useState(false);

	const relationTypes = Object.entries(RELATION_TYPE_LABELS);

	return (
		<div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
			{/* Search input */}
			<SearchInput
				searchQuery={searchQuery}
				onSearchChange={onSearchChange}
				searchResults={searchResults}
				onSelectResult={onSelectResult}
			/>

			<div
				className="flex flex-col gap-0.5 rounded-xl p-1.5"
				style={{
					background: 'var(--paper-80)',
					border: "1px solid var(--border-default)",
					boxShadow:
						"0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px var(--border-subtle)",
				}}
			>
				<FilterButton icon={ZoomIn} title="放大 (滚轮上)" onClick={onZoomIn} />
				<FilterButton
					icon={ZoomOut}
					title="缩小 (滚轮下)"
					onClick={onZoomOut}
				/>
				<FilterButton icon={RotateCcw} title="重置视图" onClick={onResetView} />
			</div>

			<div
				className="rounded-xl p-1.5"
				style={{
					background: 'var(--paper-80)',
					border: "1px solid var(--border-subtle)",
					boxShadow:
						"0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px var(--border-subtle)",
				}}
			>
				<button
					onClick={() => setIsExpanded(!isExpanded)}
					className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-all duration-200 w-full group"
				>
					<Filter className="w-3 h-3 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
					<span className="text-[10px] transition-colors font-medium" style={{ color: 'var(--ink-90)', opacity: 0.5 }}>
						筛选
					</span>
					<ChevronRight
						className="w-3 h-3 ml-auto transition-transform"
						style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", color: 'var(--ink-90)', opacity: 0.4 }}
					/>
				</button>

				<AnimatePresence>
					{isExpanded && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
							className="overflow-hidden"
						>
							<div className="pt-2 space-y-0.5">
								{(
									Object.entries(ENTITY_TYPE_CONFIG) as [
										EntityNodeType,
										(typeof ENTITY_TYPE_CONFIG)["character"],
									][]
								).map(([type, config]) => {
									const isActive = activeTypes.has(type);
									return (
										<button
											key={type}
											onClick={() => onToggleType(type)}
											className="flex items-center gap-2 px-2 py-1.5 rounded-lg w-full transition-all duration-200"
											style={{
												backgroundColor: isActive
													? `${config.color}18`
													: "transparent",
											}}
											onMouseEnter={(e) => {
												if (!isActive)
													e.currentTarget.style.backgroundColor =
														"rgba(201, 169, 110, 0.06)";
											}}
											onMouseLeave={(e) => {
												if (!isActive)
													e.currentTarget.style.backgroundColor = "transparent";
											}}
										>
											<div
												className="w-2.5 h-2.5 rounded-full transition-all duration-200"
												style={{
													backgroundColor: isActive
														? config.color
														: "var(--text-disabled)",
													opacity: isActive ? 1 : 0.3,
													boxShadow: isActive
														? `0 0 6px ${config.glowColor}`
														: "none",
												}}
											/>
											<span
												className="text-[10px] transition-colors duration-200"
												style={{
													color: isActive
														? config.color
														: "var(--ink-90)",
													opacity: isActive ? 1 : 0.5,
												}}
											>
												{config.label}
											</span>
										</button>
									);
								})}
							</div>

							<div className="pt-2 mt-2 border-t border-[var(--border-subtle)]">
								<p className="text-[10px] mb-1.5 px-2 font-medium" style={{ color: 'var(--ink-90)', opacity: 0.5 }}>
									关系类型
								</p>
								<select
									value={filterRelation}
									onChange={(e) => onSetRelationFilter(e.target.value)}
									className="w-full text-[10px] px-2 py-1.5 rounded-lg outline-none cursor-pointer transition-colors"
									style={{
										background: "var(--paper-100)",
										color: "var(--ink-100)",
										border: "1px solid var(--border-subtle)",
										fontFamily: 'var(--font-sans)',
									}}
								>
									<option value="all">全部关系</option>
									{relationTypes.map(([type, label]) => (
										<option key={type} value={type}>
											{label}
										</option>
									))}
								</select>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

function FilterButton({
	icon: Icon,
	title,
	onClick,
}: {
	icon: typeof ZoomIn;
	title: string;
	onClick: () => void;
}) {
	return (
		<button
			className="p-2 rounded-lg hover:bg-[var(--hover-bg)] transition-all duration-200 group flex items-center justify-center"
			title={title}
			onClick={onClick}
		>
			<Icon className="w-4 h-4 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
		</button>
	);
}

function Legend({
	showLegend,
	onToggle,
	visibleRelationTypes,
}: {
	showLegend: boolean;
	onToggle: () => void;
	visibleRelationTypes: string[];
}) {
	if (!showLegend) {
		return (
			<button
				onClick={onToggle}
				className="absolute bottom-3 right-3 z-10 p-2.5 rounded-xl transition-all duration-200 group"
				title="显示图例"
				style={{
					background: 'var(--paper-80)',
					border: "1px solid var(--border-subtle)",
					boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
				}}
			>
				<Eye className="w-4 h-4 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
			</button>
		);
	}

	const uniqueTypes = [...new Set(visibleRelationTypes)];

	return (
		<motion.div
			initial={{ opacity: 0, y: 8, scale: 0.96 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
			className="absolute bottom-3 right-3 z-10 rounded-xl overflow-hidden"
			style={{
				minWidth: "160px",
				background: 'var(--paper-80)',
				border: "1px solid var(--border-default)",
				boxShadow:
					"0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px var(--border-subtle)",
				fontFamily: 'var(--font-sans)',
			}}
		>
			<div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-subtle)]">
				<span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-90)', opacity: 0.6 }}>
					图例
				</span>
				<button
					onClick={onToggle}
					className="p-1 rounded-lg hover:bg-[var(--hover-bg)] transition-all duration-200"
				>
					<EyeOff className="w-3.5 h-3.5" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
				</button>
			</div>

			<div className="p-3">
				<div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
					{(
						Object.entries(ENTITY_TYPE_CONFIG) as [
							EntityNodeType,
							(typeof ENTITY_TYPE_CONFIG)["character"],
						][]
					).map(([type, config]) => (
						<div key={type} className="flex items-center gap-2">
							<div
								className="w-3 h-3 rounded-full flex-shrink-0"
								style={{
									backgroundColor: config.color,
									boxShadow: `0 0 8px ${config.glowColor}`,
								}}
							/>
							<span className="text-[10px]" style={{ color: 'var(--ink-90)', opacity: 0.75 }}>
								{config.label}
							</span>
						</div>
					))}
				</div>

				{uniqueTypes.length > 0 && (
					<>
						<div className="border-t border-[var(--border-subtle)] pt-2.5">
							<span className="text-[9px] font-medium uppercase tracking-wider mb-2 block" style={{ color: 'var(--ink-90)', opacity: 0.4 }}>
								关系类型
							</span>
							<div className="space-y-1.5">
								{uniqueTypes.slice(0, 6).map((type) => (
									<div key={type} className="flex items-center gap-2.5">
										<div
											className="w-5 h-[2px] rounded-full flex-shrink-0"
											style={{
												backgroundColor:
													RELATION_TYPE_COLORS[type] ||
													RELATION_TYPE_COLORS.other,
												boxShadow: `0 0 6px ${RELATION_TYPE_COLORS[type] || RELATION_TYPE_COLORS.other}50`,
											}}
										/>
										<span className="text-[10px]" style={{ color: 'var(--ink-90)', opacity: 0.75 }}>
											{RELATION_TYPE_LABELS[type] || type}
										</span>
									</div>
								))}
								{uniqueTypes.length > 6 && (
									<span className="text-[9px]" style={{ color: 'var(--ink-90)', opacity: 0.35 }}>
										+{uniqueTypes.length - 6} 更多
									</span>
								)}
							</div>
						</div>
					</>
				)}
			</div>
		</motion.div>
	);
}

function StatsBar({
	nodeCount,
	linkCount,
	filterRelation,
	onClearFilter,
}: {
	nodeCount: number;
	linkCount: number;
	filterRelation: string;
	onClearFilter: () => void;
}) {
	return (
		<div
			className="absolute bottom-3 left-3 z-10 text-[10px] px-3 py-2 rounded-xl flex items-center gap-2.5"
			style={{
				background: 'var(--paper-80)',
				border: "1px solid var(--border-subtle)",
				boxShadow:
					"0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px var(--border-subtle)",
				fontFamily: 'var(--font-sans)',
			}}
		>
			<span className="font-medium" style={{ color: 'var(--ink-90)', opacity: 0.75 }}>
				{nodeCount} 节点
			</span>
			<span style={{ color: 'var(--ink-90)', opacity: 0.3 }}>·</span>
			<span className="font-medium" style={{ color: 'var(--ink-90)', opacity: 0.75 }}>
				{linkCount} 关系
			</span>
			{filterRelation !== "all" && (
				<>
					<span style={{ color: 'var(--ink-90)', opacity: 0.3 }}>·</span>
					<button
						className="underline transition-colors duration-200"
						style={{ color: 'var(--accent-primary)' }}
						onClick={onClearFilter}
					>
						清除筛选
					</button>
				</>
			)}
		</div>
	);
}

function ContextMenu({
	menu,
	onClose,
	onHighlight,
	onFocus,
	onViewDetails,
}: {
	menu: ContextMenuState;
	onClose: () => void;
	onHighlight: (nodeId: string) => void;
	onFocus: (node: GraphNode) => void;
	onViewDetails: (node: GraphNode, x: number, y: number) => void;
}) {
	const config = ENTITY_TYPE_CONFIG[menu.node.type];
	const Icon = config.icon;

	const menuItems = [
		{
			icon: Info,
			label: "查看详情",
			action: () => { onViewDetails(menu.node, menu.x, menu.y); onClose(); },
		},
		{
			icon: Highlighter,
			label: "高亮关联",
			action: () => { onHighlight(menu.node.id); onClose(); },
		},
		{
			icon: Focus,
			label: "聚焦节点",
			action: () => { onFocus(menu.node); onClose(); },
		},
		{
			icon: ExternalLink,
			label: "展开连接",
			action: () => { onHighlight(menu.node.id); onClose(); },
		},
	];

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.92, y: -4 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.92, y: -4 }}
			transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
			className="absolute z-40 rounded-xl overflow-hidden min-w-[160px]"
			style={{
				left: menu.x,
				top: menu.y,
				background: 'var(--paper-80)',
				border: '1px solid var(--border-default)',
				boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px var(--border-subtle)',
				fontFamily: 'var(--font-sans)',
			}}
			onContextMenu={(e) => e.preventDefault()}
		>
			{/* Header */}
			<div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-subtle)]">
				<div
					className="w-5 h-5 rounded-md flex items-center justify-center"
					style={{
						background: `linear-gradient(135deg, ${config.color}20, ${config.color}08)`,
					}}
				>
					<Icon className="w-3 h-3" style={{ color: config.color }} />
				</div>
				<span className="text-[11px] font-semibold truncate" style={{ color: 'var(--ink-100)' }}>
					{menu.node.name}
				</span>
			</div>

			{/* Menu items */}
			<div className="p-1">
				{menuItems.map((item, idx) => (
					<button
						key={idx}
						onClick={item.action}
						className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left transition-all duration-150"
						style={{ color: 'var(--ink-90)' }}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = 'rgba(201, 169, 110, 0.1)';
							e.currentTarget.style.color = 'var(--accent-primary)';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = 'transparent';
							e.currentTarget.style.color = 'var(--ink-90)';
						}}
					>
						<item.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ opacity: 0.6 }} />
						<span className="text-[11px]">{item.label}</span>
					</button>
				))}
			</div>
		</motion.div>
	);
}

function SearchInput({
	searchQuery,
	onSearchChange,
	searchResults,
	onSelectResult,
}: {
	searchQuery: string;
	onSearchChange: (query: string) => void;
	searchResults: GraphNode[];
	onSelectResult: (node: GraphNode) => void;
}) {
	const [isFocused, setIsFocused] = useState(false);
	const showResults = isFocused && searchQuery.length > 0 && searchResults.length > 0;

	return (
		<div className="relative">
			<div
				className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all duration-200"
				style={{
					background: 'var(--color-surface-base)',
					border: `1px solid ${isFocused ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
					boxShadow: isFocused ? '0 0 0 2px rgba(201, 169, 110, 0.15)' : 'none',
				}}
			>
				<Search className="w-3 h-3 flex-shrink-0" style={{ color: isFocused ? 'var(--accent-primary)' : 'var(--ink-90)', opacity: isFocused ? 0.8 : 0.4 }} />
				<input
					type="text"
					value={searchQuery}
					onChange={(e) => onSearchChange(e.target.value)}
					onFocus={() => setIsFocused(true)}
					onBlur={() => { setTimeout(() => setIsFocused(false), 150); }}
					placeholder="搜索节点..."
					className="w-full bg-transparent text-[10px] outline-none"
					style={{
						color: 'var(--ink-100)',
						'--tw-placeholder-opacity': '0.4',
					} as React.CSSProperties}
				/>
				{searchQuery && (
					<button
						onClick={() => onSearchChange('')}
						className="p-0.5 rounded hover:bg-[var(--hover-bg)] transition-colors"
					>
						<X className="w-2.5 h-2.5" style={{ color: 'var(--ink-90)', opacity: 0.4 }} />
					</button>
				)}
			</div>

			<AnimatePresence>
				{showResults && (
					<motion.div
						initial={{ opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4 }}
						transition={{ duration: 0.12 }}
						className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-50 max-h-[160px] overflow-y-auto"
						style={{
							background: 'var(--paper-80)',
							border: '1px solid var(--border-default)',
							boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
						}}
					>
						{searchResults.slice(0, 8).map((node) => {
							const cfg = ENTITY_TYPE_CONFIG[node.type];
							const NodeIcon = cfg.icon;
							return (
								<button
									key={node.id}
									onClick={() => onSelectResult(node)}
									className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left transition-all duration-150"
									style={{ color: 'var(--ink-90)' }}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor = 'rgba(201, 169, 110, 0.08)';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = 'transparent';
									}}
								>
									<div
										className="w-2.5 h-2.5 rounded-full flex-shrink-0"
										style={{ backgroundColor: cfg.color }}
									/>
									<NodeIcon className="w-3 h-3 flex-shrink-0" style={{ color: cfg.color, opacity: 0.7 }} />
									<span className="text-[10px] truncate">{node.name}</span>
								</button>
							);
						})}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function GraphBackground() {
	return (
		<div className="absolute inset-0 pointer-events-none overflow-hidden">
			{/* Paper grain texture - subtle noise pattern */}
			<div
				className="absolute inset-0 opacity-[0.04]"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
					backgroundSize: "200px 200px",
				}}
			/>
			{/* Warm vignette effect for depth */}
			<div
				className="absolute inset-0"
				style={{
					background:
						"radial-gradient(ellipse at center, transparent 40%, rgba(26,21,16,0.12) 100%)",
				}}
			/>
			{/* Subtle brass accent glow at top */}
			<div
				className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] opacity-[0.04]"
				style={{
					background:
						"radial-gradient(ellipse at center, var(--accent-primary) 0%, transparent 70%)",
				}}
			/>
		</div>
	);
}

export function RelationGraph() {
	const containerRef = useRef<HTMLDivElement>(null);
	const fgRef = useRef<any>(null);
	const { characters } = useSettingsStore();
	const [isGenerating, setIsGenerating] = useState(false);
	// RAF-managed animation state to avoid React re-renders
	const animationTimeRef = useRef({ pulse: 0, orbit: 0, flow: 0, particle: 0 });
	const animationRafRef = useRef<number>();

	const [dimensions, setDimensions] = useState({ width: 300, height: 400 });
	const [viewport, setViewport] = useState({
		x: 0,
		y: 0,
		width: 300,
		height: 400,
	});
	const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
	const [activeNodeTypes, setActiveNodeTypes] = useState<Set<EntityNodeType>>(
		new Set(Object.keys(ENTITY_TYPE_CONFIG) as EntityNodeType[]),
	);
	const [filterRelation, setFilterRelation] = useState<string>("all");
	const [showLegend, setShowLegend] = useState(true);
	const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
	const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(
		null,
	);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

	const { nodes: allNodes, links: allLinks } = useGraphData();

	const { nodes, links } = useMemo(() => {
		const filteredNodes = allNodes.filter((n) => activeNodeTypes.has(n.type));
		const nodeIds = new Set(filteredNodes.map((n) => n.id));
		let filteredLinks = allLinks.filter(
			(l) => nodeIds.has(l.source) && nodeIds.has(l.target),
		);
		if (filterRelation !== "all") {
			filteredLinks = filteredLinks.filter((l) => l.type === filterRelation);
		}
		return { nodes: filteredNodes, links: filteredLinks };
	}, [allNodes, allLinks, activeNodeTypes, filterRelation]);

	const visibleNodes = useMemo(() => {
		const buffer = 100;
		return nodes.filter((node) => {
			const nx = (node as any).x || 0;
			const ny = (node as any).y || 0;
			return (
				nx >= viewport.x - buffer &&
				nx <= viewport.x + viewport.width + buffer &&
				ny >= viewport.y - buffer &&
				ny <= viewport.y + viewport.height + buffer
			);
		});
	}, [nodes, viewport]);

	const visibleLinks = useMemo(() => {
		const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
		return links.filter(
			(link) =>
				visibleNodeIds.has(link.source as string) &&
				visibleNodeIds.has(link.target as string),
		);
	}, [links, visibleNodes]);

	const renderMode = useMemo(() => {
		if (nodes.length > PERFORMANCE_THRESHOLD * 1.5) return "simple";
		if (nodes.length > PERFORMANCE_THRESHOLD) return "optimized";
		return "full";
	}, [nodes.length]);

	useEffect(() => {
		const updateDimensions = () => {
			if (containerRef.current) {
				const { width, height } = containerRef.current.getBoundingClientRect();
				setDimensions({ width, height });
				setViewport((prev) => ({ ...prev, width, height }));
			}
		};
		updateDimensions();
		const observer = new ResizeObserver(updateDimensions);
		if (containerRef.current) observer.observe(containerRef.current);
		window.addEventListener("resize", updateDimensions);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updateDimensions);
		};
	}, []);

	const updateViewport = useCallback(
		(centerZoom: { k: number; x: number; y: number }) => {
			const newViewport = {
				x: -centerZoom.x / centerZoom.k,
				y: -centerZoom.y / centerZoom.k,
				width: dimensions.width / centerZoom.k,
				height: dimensions.height / centerZoom.k,
			};
			setViewport(newViewport);
		},
		[dimensions],
	);

	const toggleNodeType = useCallback((type: EntityNodeType) => {
		setActiveNodeTypes((prev) => {
			const next = new Set(prev);
			if (next.has(type)) {
				if (next.size > 1) next.delete(type);
			} else {
				next.add(type);
			}
			return next;
		});
	}, []);

	const handleNodeClick = useCallback((node: any, event: MouseEvent) => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		setSelectedNode({
			node: node as GraphNode,
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		});
	}, []);

	const handleBackgroundClick = useCallback(() => {
		setSelectedNode(null);
		setContextMenu(null);
		setHighlightedNodeId(null);
	}, []);

	const toggleFullscreen = useCallback(() => {
		setIsFullscreen((prev) => !prev);
		setTimeout(() => {
			if (fgRef.current) {
				fgRef.current.zoomToFit(400, 40);
			}
		}, 100);
	}, []);

	const handleGenerateRelations = useCallback(() => {
		setIsGenerating(true);
		setTimeout(() => {
			setIsGenerating(false);
		}, 2000);
	}, []);

	// Search results
	const searchResults = useMemo(() => {
		if (!searchQuery.trim()) return [];
		const q = searchQuery.toLowerCase();
		return allNodes.filter(
			(n) => n.name.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)
		);
	}, [searchQuery, allNodes]);

	// Combined active highlight: selected node or explicitly highlighted node
	const activeHighlightId = highlightedNodeId || selectedNode?.node.id || null;

	// Right-click context menu handler
	const handleNodeRightClick = useCallback((node: any, event: MouseEvent) => {
		event.preventDefault();
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		setContextMenu({
			node: node as GraphNode,
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		});
		setSelectedNode(null);
	}, []);

	// Context menu actions
	const handleHighlightConnections = useCallback((nodeId: string) => {
		setHighlightedNodeId((prev) => (prev === nodeId ? null : nodeId));
	}, []);

	const handleFocusNode = useCallback((node: GraphNode) => {
		if (fgRef.current) {
			const graphNode = (fgRef.current as any).graphData()?.nodes?.find(
				(n: any) => n.id === node.id
			);
			if (graphNode) {
				fgRef.current.centerAt(graphNode.x, graphNode.y, 600);
				fgRef.current.zoom(2.5, 600);
			}
		}
		setHighlightedNodeId(node.id);
	}, []);

	const handleViewDetailsFromMenu = useCallback((node: GraphNode, x: number, y: number) => {
		setSelectedNode({ node, x, y });
	}, []);

	const handleSearchResultSelect = useCallback((node: GraphNode) => {
		setSearchQuery('');
		setHighlightedNodeId(node.id);
		if (fgRef.current) {
			const graphNode = (fgRef.current as any).graphData()?.nodes?.find(
				(n: any) => n.id === node.id
			);
			if (graphNode) {
				fgRef.current.centerAt(graphNode.x, graphNode.y, 600);
				fgRef.current.zoom(2.5, 600);
			}
		}
	}, []);

	// Track node position for hover tooltip during drag
	const handleNodeDrag = useCallback((node: any) => {
		if (!node) return;
		setHoverTooltip({
			node: node as GraphNode,
			x: (node.x as number) || 0,
			y: (node.y as number) || 0,
		});
	}, []);

	// Separate RAF loop for animations - updates ref only, no React state changes
	useEffect(() => {
		const animate = () => {
			const now = Date.now();
			animationTimeRef.current = {
				pulse: now,
				orbit: now / 1500,
				flow: now / 800,
				particle: now / 1000,
			};
			// Refresh canvas without triggering React re-render
			if (fgRef.current && typeof fgRef.current.refresh === "function") {
				fgRef.current.refresh();
			}
			animationRafRef.current = requestAnimationFrame(animate);
		};
		animationRafRef.current = requestAnimationFrame(animate);
		return () => {
			if (animationRafRef.current) cancelAnimationFrame(animationRafRef.current);
		};
	}, []);

	// Custom node canvas renderer with enhanced visuals
	const nodeCanvasObject = useCallback(
		(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
			const config = ENTITY_TYPE_CONFIG[node.type as EntityNodeType];
			const isHovered = node.id === hoveredNodeId;
			const isSelected = selectedNode?.node.id === node.id || activeHighlightId === node.id;
			const baseSize = config?.size || 6;
			const baseRadius = Math.sqrt(node.val) * baseSize + baseSize;
			const radius = baseRadius * (isHovered ? 1.3 : 1);

			const x = node.x as number;
			const y = node.y as number;

			// Pulsing animation for hovered nodes - use ref time, not Date.now()
			const pulseScale = isHovered ? 1 + Math.sin(animationTimeRef.current.pulse / 200) * 0.08 : 1;
			const finalRadius = radius * pulseScale;

			// Multi-layer glow effect with stronger outer glow
			if (isHovered || isSelected) {
				for (let i = 5; i > 0; i--) {
					const glowRadius = finalRadius + i * 10;
					const glowGradient = ctx.createRadialGradient(
						x,
						y,
						finalRadius,
						x,
						y,
						glowRadius,
					);
					glowGradient.addColorStop(
						0,
						config?.glowStrong || "rgba(201, 169, 110, 0.5)",
					);
					glowGradient.addColorStop(0.4, config?.glowColor || "rgba(201, 169, 110, 0.2)");
					glowGradient.addColorStop(1, "transparent");
					ctx.fillStyle = glowGradient;
					ctx.beginPath();
					ctx.arc(x, y, glowRadius, 0, 2 * Math.PI);
					ctx.fill();
				}
			}

			// Orbit ring animation for hovered nodes
			if (isHovered && renderMode === "full") {
				const time = animationTimeRef.current.orbit;
				const ringRadius = finalRadius + 14;
				ctx.beginPath();
				ctx.arc(x, y, ringRadius, time, time + Math.PI * 1.5);
				ctx.strokeStyle = config?.ringColor || "rgba(201, 169, 110, 0.3)";
				ctx.lineWidth = 1.5;
				ctx.setLineDash([4, 4]);
				ctx.stroke();
				ctx.setLineDash([]);
			}

			// Inner glow ring for all nodes (subtle type-based glow)
			if (renderMode === "full") {
				const innerGlowRadius = finalRadius + 4;
				const innerGlow = ctx.createRadialGradient(
					x, y, finalRadius,
					x, y, innerGlowRadius,
				);
				innerGlow.addColorStop(0, `${config?.color || "#c9a96e"}30`);
				innerGlow.addColorStop(1, "transparent");
				ctx.fillStyle = innerGlow;
				ctx.beginPath();
				ctx.arc(x, y, innerGlowRadius, 0, 2 * Math.PI);
				ctx.fill();
			}

			// Outer ring shadow
			ctx.shadowColor = isHovered
				? config?.color || "#c9a96e"
				: "rgba(0,0,0,0.5)";
			ctx.shadowBlur = isHovered ? 25 : 8;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = isHovered ? 0 : 4;

			// Main node circle - leather-textured warm brown gradient
			const nodeGradient = ctx.createRadialGradient(
				x - finalRadius * 0.35,
				y - finalRadius * 0.35,
				0,
				x,
				y,
				finalRadius,
			);
			nodeGradient.addColorStop(0, "#3d3225");
			nodeGradient.addColorStop(0.5, "#2a2118");
			nodeGradient.addColorStop(1, "#1e1812");

			ctx.beginPath();
			ctx.arc(x, y, finalRadius, 0, 2 * Math.PI);
			ctx.fillStyle = nodeGradient;
			ctx.fill();

			// Entity-type color ring around the node
			const ringRadius = finalRadius + 1.5;
			ctx.beginPath();
			ctx.arc(x, y, ringRadius, 0, 2 * Math.PI);
			ctx.strokeStyle = isHovered
				? `${config?.color || "#c9a96e"}cc`
				: isSelected
					? `${config?.color || "#c9a96e"}99`
					: `${config?.color || "#c9a96e"}55`;
			ctx.lineWidth = isHovered ? 2.5 : isSelected ? 2 : 1.5;
			ctx.stroke();

			// Reset shadow
			ctx.shadowBlur = 0;
			ctx.shadowOffsetY = 0;

			// Inner highlight (top-left) - subtle leather sheen
			const highlightGradient = ctx.createRadialGradient(
				x - finalRadius * 0.3,
				y - finalRadius * 0.3,
				0,
				x,
				y,
				finalRadius * 0.7,
			);
			highlightGradient.addColorStop(0, "rgba(201, 169, 110, 0.15)");
			highlightGradient.addColorStop(0.5, "rgba(201, 169, 110, 0.04)");
			highlightGradient.addColorStop(1, "transparent");
			ctx.beginPath();
			ctx.arc(x, y, finalRadius * 0.7, 0, 2 * Math.PI);
			ctx.fillStyle = highlightGradient;
			ctx.fill();

			// Animated border ring - brass accent for selected
			const borderWidth = isHovered ? 2.5 : isSelected ? 2 : 0;
			if (borderWidth > 0) {
				ctx.beginPath();
				ctx.arc(x, y, finalRadius + 4, 0, 2 * Math.PI);
				ctx.strokeStyle = isHovered
					? "rgba(201, 169, 110, 0.7)"
					: "rgba(201, 169, 110, 0.5)";
				ctx.lineWidth = borderWidth;
				ctx.stroke();
			}

			// Connection ring for nodes with many relationships - brass dashed
			if (node.val > 3) {
				ctx.beginPath();
				ctx.arc(x, y, finalRadius + 7, 0, 2 * Math.PI);
				ctx.strokeStyle = "rgba(201, 169, 110, 0.2)";
				ctx.lineWidth = 1;
				ctx.setLineDash([6, 3]);
				ctx.stroke();
				ctx.setLineDash([]);
			}

			// Node label
			const label = node.name;
			const fontSize = Math.max(11 / globalScale, 9);
			ctx.font = `${isHovered ? "600" : "500"} ${fontSize}px "Source Han Sans", "Noto Sans SC", system-ui, sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";

			const yOffset = finalRadius + fontSize * 1.2;

			const displayLabel = label.length > 8 ? label.slice(0, 8) + ".." : label;
			const textMetrics = ctx.measureText(displayLabel);
			const textWidth = textMetrics.width;
			const padding = 5;

			// Label shadow for better readability
			ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
			ctx.beginPath();
			ctx.roundRect(
				x - textWidth / 2 - padding,
				y + yOffset - fontSize / 2 - padding / 2 + 1,
				textWidth + padding * 2,
				fontSize + padding,
				4,
			);
			ctx.fill();

			ctx.fillStyle = "rgba(26, 21, 16, 0.88)";
			ctx.beginPath();
			ctx.roundRect(
				x - textWidth / 2 - padding,
				y + yOffset - fontSize / 2 - padding / 2,
				textWidth + padding * 2,
				fontSize + padding,
				4,
			);
			ctx.fill();

			// Label text - warm white
			ctx.fillStyle = isHovered ? "#f5eed6" : "rgba(245, 238, 214, 0.78)";
			ctx.fillText(displayLabel, x, y + yOffset);

			// Type indicator dot for hovered nodes
			if (isHovered) {
				const dotX = x - textWidth / 2 - 10;
				const dotY = y + yOffset;
				ctx.beginPath();
				ctx.arc(dotX, dotY, 4, 0, 2 * Math.PI);
				ctx.fillStyle = config?.color || node.color;
				ctx.shadowColor = config?.color || node.color;
				ctx.shadowBlur = 8;
				ctx.fill();
				ctx.shadowBlur = 0;
			}
		},
		[hoveredNodeId, selectedNode, activeHighlightId, renderMode],
	);

	// Custom link renderer with gradient and animated flow
	const linkCanvasObject = useCallback(
		(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
			const focusId = hoveredNodeId || activeHighlightId;
			const isHighlighted =
				focusId &&
				(link.source.id === focusId || link.target.id === focusId);
			const isDimmed = focusId && !isHighlighted;

			if (isDimmed && renderMode === "simple") return;

			const start = link.source;
			const end = link.target;
			const sx = start.x as number;
			const sy = start.y as number;
			const ex = end.x as number;
			const ey = end.y as number;

			// Calculate control point for curved lines
			const midX = (sx + ex) / 2;
			const midY = (sy + ey) / 2;
			const dx = ex - sx;
			const dy = ey - sy;
			const dist = Math.sqrt(dx * dx + dy * dy);
			const curvature = Math.min(dist * 0.15, 35);
			const perpX = (-dy / dist) * curvature;
			const perpY = (dx / dist) * curvature;
			const cx = midX + perpX;
			const cy = midY + perpY;

			const opacity = isDimmed ? 0.05 : isHighlighted ? 1 : 0.45;
			const lineWidth = isHighlighted ? 3 : isDimmed ? 0.5 : 1.5;

			// Brass-tinted edge color
			const color = link.color || "#c9a96e";

			const parseColor = (c: string, a: number) => {
				if (c.startsWith("#")) {
					const r = parseInt(c.slice(1, 3), 16);
					const g = parseInt(c.slice(3, 5), 16);
					const b = parseInt(c.slice(5, 7), 16);
					return `rgba(${r},${g},${b},${a})`;
				}
				return c;
			};

			// Create gradient along the curved line
			const gradient = ctx.createLinearGradient(sx, sy, ex, ey);
			gradient.addColorStop(0, parseColor(color, opacity * 0.2));
			gradient.addColorStop(0.3, parseColor(color, opacity * 0.7));
			gradient.addColorStop(0.7, parseColor(color, opacity));
			gradient.addColorStop(1, parseColor(color, opacity * 0.2));

			ctx.strokeStyle = gradient;
			ctx.globalAlpha = 1;
			ctx.lineWidth = lineWidth / globalScale;
			ctx.lineCap = "round";

			// Draw main curved path with shadow
			if (isHighlighted) {
				ctx.shadowColor = color;
				ctx.shadowBlur = 8;
			}

			ctx.beginPath();
			ctx.moveTo(sx, sy);
			ctx.quadraticCurveTo(cx, cy, ex, ey);
			ctx.stroke();

			ctx.shadowBlur = 0;

			// Flowing dashed line animation for all links in full mode - vintage dash
			if (renderMode === "full") {
				const flowTime = animationTimeRef.current.flow;
				const dashLength = 6;
				const gapLength = isHighlighted ? 3 : 8;
				const flowOffset = (flowTime * 10) % (dashLength + gapLength);

				ctx.beginPath();
				ctx.moveTo(sx, sy);
				ctx.quadraticCurveTo(cx, cy, ex, ey);
				ctx.strokeStyle = parseColor(color, isHighlighted ? opacity * 0.5 : opacity * 0.18);
				ctx.lineWidth = (isHighlighted ? 1.5 : 0.8) / globalScale;
				ctx.setLineDash([dashLength, gapLength]);
				ctx.lineDashOffset = -flowOffset;
				ctx.stroke();
				ctx.setLineDash([]);
			}

			// Animated flowing particles for highlighted links
			if (isHighlighted && renderMode === "full") {
				const time = animationTimeRef.current.particle;
				const particleCount = 3;

				for (let i = 0; i < particleCount; i++) {
					const t = (time * 0.5 + i / particleCount) % 1;
					const px = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
					const py = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;
					const particleSize = 3 - t * 2;

					ctx.beginPath();
					ctx.arc(px, py, particleSize, 0, 2 * Math.PI);
					ctx.fillStyle = parseColor(color, (1 - t) * 0.8);
					ctx.shadowColor = color;
					ctx.shadowBlur = 6;
					ctx.fill();
				}
				ctx.shadowBlur = 0;
			}

			// Arrow head for directional relations
			if (isHighlighted && renderMode !== "simple") {
				const angle = Math.atan2(ey - cy, ex - cx);
				const arrowSize = 6 / globalScale;
				const arrowX = ex - Math.cos(angle) * (curvature * 0.3 + 5);
				const arrowY = ey - Math.sin(angle) * (curvature * 0.3 + 5);

				ctx.beginPath();
				ctx.moveTo(arrowX, arrowY);
				ctx.lineTo(
					arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
					arrowY - arrowSize * Math.sin(angle - Math.PI / 6),
				);
				ctx.lineTo(
					arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
					arrowY - arrowSize * Math.sin(angle + Math.PI / 6),
				);
				ctx.closePath();
				ctx.fillStyle = parseColor(color, opacity * 0.8);
				ctx.fill();
			}
		},
		[hoveredNodeId, activeHighlightId, renderMode],
	);

	if (characters.length === 0 && allNodes.length === 0) {
		return (
			<div className="h-full flex items-center justify-center text-center p-4 bg-[var(--ink-100)] relative overflow-hidden rounded-lg border border-[var(--border-subtle)]">
				<GraphBackground />
				<motion.div
					className="relative z-10"
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
				>
					<motion.div
						className="relative mx-auto mb-4 w-14 h-14 rounded-xl flex items-center justify-center"
						style={{
							background: "var(--paper-80)",
							border: "1px solid var(--border-subtle)",
							boxShadow: "inset 0 1px 0 var(--border-subtle)",
						}}
						initial={{ scale: 0.9 }}
						animate={{ scale: 1 }}
						transition={{ type: "spring", stiffness: 400, damping: 25 }}
					>
						<LinkIcon className="w-5 h-5" style={{ color: 'var(--accent-primary)', opacity: 0.6 }} />
					</motion.div>
					<p className="text-sm mb-1 font-medium" style={{ color: 'var(--paper-80)', opacity: 0.75 }}>
						添加角色后
					</p>
					<p className="text-xs" style={{ color: 'var(--paper-80)', opacity: 0.4 }}>
						这里将显示关系图谱
					</p>
				</motion.div>
			</div>
		);
	}

	if (nodes.length === 0) {
		return (
			<div className="h-full flex items-center justify-center text-center p-4 bg-[var(--ink-100)] relative overflow-hidden rounded-lg border border-[var(--border-subtle)]">
				<GraphBackground />
				<motion.div
					className="relative z-10"
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
				>
					<motion.div
						className="relative mx-auto mb-4 w-14 h-14 rounded-xl flex items-center justify-center"
						style={{
							background: "var(--paper-80)",
							border: "1px solid var(--border-subtle)",
							boxShadow: "inset 0 1px 0 var(--border-subtle)",
						}}
						initial={{ scale: 0.9 }}
						animate={{ scale: 1 }}
						transition={{ type: "spring", stiffness: 400, damping: 25 }}
					>
						<Filter className="w-5 h-5" style={{ color: 'var(--accent-primary)', opacity: 0.6 }} />
					</motion.div>
					<p className="text-sm mb-1 font-medium" style={{ color: 'var(--paper-80)', opacity: 0.75 }}>
						筛选条件过于严格
					</p>
					<p className="text-xs" style={{ color: 'var(--paper-80)', opacity: 0.4 }}>
						没有符合条件的节点
					</p>
				</motion.div>
			</div>
		);
	}

	const visibleRelationTypes = [...new Set(visibleLinks.map((l) => l.type))];

	return (
		<div
			ref={containerRef}
			className={`relative overflow-hidden ${isFullscreen ? "fixed inset-0 z-50" : "h-full rounded-lg"}`}
			style={{
				background: 'var(--ink-100)',
				border: isFullscreen ? undefined : "1px solid var(--border-subtle)",
			}}
			onContextMenu={(e) => e.preventDefault()}
		>
			<GraphBackground />

			{/* Top accent line - simplified */}
			<div
				className="absolute top-0 left-0 right-0 h-px z-10"
				style={{
					background:
						"linear-gradient(90deg, transparent, var(--accent-100), transparent)",
					opacity: 0.25,
				}}
			/>

			{/* Generate Relations Button */}
			<div className="absolute top-3 right-20 z-10">
				<motion.button
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
					onClick={handleGenerateRelations}
					disabled={isGenerating}
					className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-medium transition-all duration-300 disabled:opacity-70"
					style={{
						background: isGenerating
							? "var(--accent-muted)"
							: "var(--paper-80)",
						border: "1px solid var(--border-default)",
						boxShadow: isGenerating
							? "0 0 12px var(--accent-glow)"
							: "0 2px 8px rgba(0,0,0,0.08)",
						color: "var(--accent-primary)",
					}}
				>
					{isGenerating ? (
						<>
							<div className="w-3 h-3 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
							<span>生成中...</span>
						</>
					) : (
						<>
							<Sparkles className="w-3.5 h-3.5" />
							<span>生成关系</span>
						</>
					)}
				</motion.button>
			</div>

			{/* View mode toggle */}
			<div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
				<button
					onClick={toggleFullscreen}
					className="p-2 rounded-xl transition-all duration-200 group"
					title={isFullscreen ? "退出全屏" : "全屏"}
					style={{
						background: 'var(--paper-80)',
						border: "1px solid var(--border-subtle)",
						boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
					}}
				>
					{isFullscreen ? (
						<Minimize2 className="w-3.5 h-3.5 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
					) : (
						<Maximize2 className="w-3.5 h-3.5 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
					)}
				</button>
				<button
					onClick={() => setViewMode(viewMode === "2d" ? "3d" : "2d")}
					className="p-2 rounded-xl transition-all duration-200 flex items-center gap-1.5 group"
					title={viewMode === "2d" ? "切换到3D视图" : "切换到2D视图"}
					style={{
						background: 'var(--paper-80)',
						border: "1px solid var(--border-subtle)",
						boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
					}}
				>
					{viewMode === "2d" ? (
						<Box className="w-3.5 h-3.5 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
					) : (
						<Grid2x2 className="w-3.5 h-3.5 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
					)}
					<span className="text-[10px] transition-colors font-medium" style={{ color: 'var(--ink-90)', opacity: 0.5 }}>
						{viewMode.toUpperCase()}
					</span>
				</button>
			</div>

			{/* Filter controls with zoom */}
			<FilterControls
				activeTypes={activeNodeTypes}
				onToggleType={toggleNodeType}
				filterRelation={filterRelation}
				onSetRelationFilter={setFilterRelation}
				onZoomIn={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 300)}
				onZoomOut={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.3, 300)}
				onResetView={() => fgRef.current?.zoomToFit(400, 40)}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				searchResults={searchResults}
				onSelectResult={handleSearchResultSelect}
			/>

			{/* Force Graph */}
			<Suspense fallback={<GraphFallback />}>
				{viewMode === "2d" ? (
					<ForceGraph2D
						ref={fgRef}
						graphData={{ nodes: visibleNodes, links: visibleLinks }}
						width={dimensions.width}
						height={dimensions.height}
						backgroundColor="transparent"
						nodeLabel="name"
						nodeColor={(node: any) => node.color}
						nodeVal={(node: any) => Math.sqrt(node.val) * 6 + 4}
						nodeRelSize={6}
						linkColor={(link: any) => link.color}
						linkWidth={(link: any) => {
							const focusId = hoveredNodeId || activeHighlightId;
							const isHighlighted =
								focusId &&
								(link.source.id === focusId ||
									link.target.id === focusId);
							return isHighlighted ? 2.5 : 1;
						}}
						{...{
							linkOpacity: (link: any) => {
								if (renderMode === "simple") return 0.2;
								const focusId = hoveredNodeId || activeHighlightId;
								const isHighlighted =
									focusId &&
									(link.source.id === focusId ||
										link.target.id === focusId);
								const isDimmed = focusId && !isHighlighted;
								return isDimmed ? 0.08 : isHighlighted ? 0.9 : 0.35;
							},
						}}
						linkDirectionalParticles={renderMode === "full" ? 2 : 0}
						linkDirectionalParticleSpeed={renderMode === "full" ? 0.008 : 0}
						linkDirectionalParticleWidth={(link: any) => {
							const focusId = hoveredNodeId || activeHighlightId;
							const isHighlighted =
								renderMode !== "simple" &&
								focusId &&
								(link.source.id === focusId ||
									link.target.id === focusId);
							return isHighlighted ? 2 : 0;
						}}
						onNodeClick={handleNodeClick}
						onBackgroundClick={handleBackgroundClick}
						onNodeRightClick={handleNodeRightClick}
						onNodeHover={
							renderMode !== "simple"
								? (node: any) => {
										setHoveredNodeId(node?.id || null);
										if (!node) setHoverTooltip(null);
									}
								: undefined
						}
						onNodeDrag={renderMode !== "simple" ? handleNodeDrag : undefined}
						onEngineStop={() => {
							if (fgRef.current) {
								const centerGraph = fgRef.current.centerAt();
								const zoom = fgRef.current.zoom();
								updateViewport({
									k: zoom,
									x: centerGraph.x || 0,
									y: centerGraph.y || 0,
								});
							}
						}}
						cooldownTicks={
							renderMode === "simple"
								? 30
								: renderMode === "optimized"
									? 60
									: 100
						}
						warmupTicks={
							renderMode === "simple" ? 5 : renderMode === "optimized" ? 10 : 20
						}
						d3AlphaDecay={renderMode === "simple" ? 0.05 : 0.02}
						d3VelocityDecay={renderMode === "simple" ? 0.5 : 0.3}
						enableNodeDrag={true}
						enableZoomInteraction={true}
						enablePanInteraction={true}
						nodeCanvasObjectMode={() => "replace"}
						nodeCanvasObject={
							renderMode === "simple" ? undefined : nodeCanvasObject
						}
						linkCanvasObjectMode={() => "replace"}
						linkCanvasObject={
							renderMode === "simple" ? undefined : linkCanvasObject
						}
					/>
				) : (
					<ForceGraph3D
						ref={fgRef}
						graphData={{ nodes: visibleNodes, links: visibleLinks }}
						width={dimensions.width}
						height={dimensions.height}
						backgroundColor="transparent"
						nodeLabel="name"
						nodeColor={(node: any) => node.color}
						nodeVal={(node: any) => Math.sqrt(node.val) * 4 + 3}
						linkColor={(link: any) => link.color}
						linkWidth={0.5}
						linkOpacity={0.4}
						onNodeClick={handleNodeClick}
						onBackgroundClick={handleBackgroundClick}
						onNodeRightClick={handleNodeRightClick}
						enableNodeDrag={true}
						enableNavigationControls={true}
						showNavInfo={false}
						cooldownTicks={100}
						warmupTicks={20}
					/>
				)}
			</Suspense>

			{/* Node hover tooltip */}
			<AnimatePresence>
				{hoverTooltip && !selectedNode && (
					<NodeHoverTooltip
						tooltip={hoverTooltip}
						containerRef={containerRef}
					/>
				)}
			</AnimatePresence>

			{/* Node detail panel (click) */}
			<AnimatePresence>
				{selectedNode && (
					<NodeDetailPanel
						detail={selectedNode}
						onClose={() => setSelectedNode(null)}
					/>
				)}
			</AnimatePresence>

			{/* Context menu (right-click) */}
			<AnimatePresence>
				{contextMenu && (
					<ContextMenu
						menu={contextMenu}
						onClose={() => setContextMenu(null)}
						onHighlight={handleHighlightConnections}
						onFocus={handleFocusNode}
						onViewDetails={handleViewDetailsFromMenu}
					/>
				)}
			</AnimatePresence>

			{/* Stats bar */}
			<StatsBar
				nodeCount={visibleNodes.length}
				linkCount={visibleLinks.length}
				filterRelation={filterRelation}
				onClearFilter={() => setFilterRelation("all")}
			/>

			{/* Legend */}
			<Legend
				showLegend={showLegend}
				onToggle={() => setShowLegend(!showLegend)}
				visibleRelationTypes={visibleRelationTypes}
			/>
		</div>
	);
}
