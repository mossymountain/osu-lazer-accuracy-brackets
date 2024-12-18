#!/usr/bin/node
let mod_combinations = ['DT', 'FL', 'HR', 'DT:HR', 'HRFLDT'].join(',');
const auto_generated_signature = ' [safe to delete]'
const legacy_brackets = [
	0,
	.60,
	.725,
	.784,
	.834,
	.875,
	.909,
	.936,
	//.957,
	.973,
	//.984,
	.995,
];

import { ArgumentParser } from 'argparse';
const parser = new ArgumentParser({ description: 'Generate accuracy brackets for osu!lazer'});
parser.add_argument('client_realm_file_path');
parser.add_argument('--graceperiod-play-count', {type: 'int', default: -1,
	help: `require at most n scores after each score to include it in brackets, defaults to [-1 (disabled)]`});
parser.add_argument('--graceperiod-days', {type: 'int', default: 7,
	help: `require at most n days after each score to include it in brackets, defaults to 7. (set either graceperiod type to 0 to include ALL scores)`});
parser.add_argument('--number-of-brackets', {type: 'int', default: legacy_brackets.length,
	help: `number of brackets to generate, defaults to ${legacy_brackets.length}, for example: [${legacy_brackets.join(' ')}]`});
parser.add_argument('--verbose', {action: 'store_true'});
parser.add_argument('--read-only', '--dry-run', {action: 'store_true', default: false,
	help: "Don't modify osu!'s database in any way (open as read-only)"});
parser.add_argument('--no-separate-perfect', {action: 'store_false', dest: 'separate_perfect', default: true,
	help: 'Do not separate perfect scores to their own bracket prior to calculating brackets from the scores. (it will be done by default)'});
parser.add_argument('--mod-combinations', {default: mod_combinations,
	help: `comma-separated lists of two-letter mod abbreviations, E.G. ${JSON.stringify(mod_combinations)}`});
const args = parser.parse_args();
const client_realm_file_path = args.client_realm_file_path;
const verbose = args.verbose;
const graceperiod_days_count = Math.max(0, args.graceperiod_days);
const graceperiod_cutoff_date = (()=>{let d=new Date();d.setDate(d.getDate()-graceperiod_days_count);return d})()
const graceperiod_play_count = args.graceperiod_play_count;
const number_of_brackets = args.number_of_brackets;
if (number_of_brackets < 2) {
	throw `--number-of-brackets needs to be at least 2`;
}
const separate_perfect = args.separate_perfect;
let mod_acronyms_to_check = new Set();
const letters = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
mod_combinations = args.mod_combinations.toUpperCase().split(',').reduce((ret, x) => {
	let rr = new Array();
	if (x.indexOf(':') != -1) {
		rr = x.split(':');
	} else {
		if (x.length & 1) {
			throw `${JSON.stringify(x)}.length ${x.length} isn't divisible by 2`;
		}
		for (let i=2; i < x.length; i++) {
			if (!letters.has(x[i])) {
				throw `Not a letter: ${JSON.stringify(x[i])} (from ${JSON.stringify(x)}`;
			}
		}
		for (let i=2; i <= x.length; i+=2) {
			rr.push(x.substring(i-2, i));
		}
	}
	rr = Array.from(new Set(rr)).sort();
	rr.forEach((acronym) => {
		mod_acronyms_to_check.add(acronym);
	});
	ret.push(rr.join(''));
	return ret;
}, new Array());
mod_combinations = new Set([''].concat(...mod_combinations));
if (verbose) {
	console.log(`mod_combinations: ${JSON.stringify(Array.from(mod_combinations).sort())}`);
	console.log(`mod_acronyms_to_check: ${JSON.stringify(Array.from(mod_acronyms_to_check).sort())}`);
}

import Realm from "realm";

import client_schema from './client-classes/client-model.cjs';

const realm = await Realm.open({
	//schema: [client_schema.Skin, client_schema.RealmNamedFileUsage, client_schema.File],
	schema: [
		client_schema.BeatmapCollection,
		client_schema.Score,
			client_schema.Beatmap,
				client_schema.BeatmapDifficulty,
				client_schema.BeatmapMetadata,
				client_schema.BeatmapUserSettings,
				client_schema.BeatmapSet,
			client_schema.Ruleset,
			client_schema.RealmNamedFileUsage,
				client_schema.File,
			client_schema.RealmUser,
	],
	schemaVersion: 44,
	path: client_realm_file_path,
	readOnly: args.read_only,
});

function is_legacy_beatmapcollection_name(n) {
	let i = 0;
	if (n === 'graceperiod' || n.startsWith('!!!') || n.startsWith('HDHR!!!')) {
		return true;
	}
	if (n.length > 5) {
		if (n.startsWith('HDHR')) {
			i += 4;
		} else {
			return false;
		}
	}
	for (; i < n.length; i++) {
		let c = n[i];
		if (c !== '.' && (c < '0' || c > '9')) {
			return false;
		}
	}
	return true;
}

function is_auto_generated_beatmapcollection_name_to_delete(n) {
	return n.endsWith(auto_generated_signature) || n.endsWith(JSON.stringify(auto_generated_signature));
}

function inv_repr(value) {
	if (typeof(value) == 'string') {
		return value
	}
	let ret = JSON.stringify(value);
	if (ret.length > 2 && ret[0] == '"' && ret[ret.length-1] == '"') {
		return JSON.parse(ret);
	}
	return ret;
}

function delete_rename_old(realm) {
	realm.objects("BeatmapCollection").forEach((collection) => {
		let renamed = false;
		let delete_this = false;
		if (is_auto_generated_beatmapcollection_name_to_delete(collection.Name)) {
			delete_this = true;
		} else if (is_legacy_beatmapcollection_name(collection.Name)) {
			renamed = true;
			realm.write(() => {
				collection.Name = 'LEGACY ' + collection.Name;
			});
		}
		if (verbose) {
			process.stdout.write(inv_repr(collection.LastModified) + ' ' + inv_repr(collection.ID) + ' ');
			if (delete_this) {
				process.stdout.write('\x1b[1;31mDELETED\x1b[m: ');
			} else if (renamed) {
				process.stdout.write('\x1b[1;32mRENAMED\x1bm: \x1b[1;33m${JSON.stringify(collection.Name)}\x1b[m --> \x1b[1;33m');
			}
			process.stdout.write(JSON.stringify(collection.Name));
			if (renamed) {
				process.stdout.write('\x1b[m');
			}
			console.log((collection.BeatmapMD5Hashes.length > 0)
				? (' first beatmap MD5: ' + collection.BeatmapMD5Hashes[0])
				: ' [empty!]');
		}
		if ( delete_this === true ) {
			realm.write(() => {
				realm.delete(collection);
				collection = null;
			});
		}
	});
}

function round_fixed(value, n) {
	let m = 10*n
	return (Math.round(value * m) / 100).toFixed(n);
}

function format_score(score) {
	//let _bmapuuid = score.BeatmapInfo.ID;
	//let _bmap = beatmaps.filtered("ID == $0", _bmapuuid)[0];

	let _bmap = score.BeatmapInfo;
	let _meta = _bmap.Metadata;
	let title = _meta.Title ?? '[\x1b[1;31mUNSET TITLE\x1b[m]';
	let title_u = _meta.TitleUnicode;
	if (title_u && title_u !== title) {
		title = title_u;
	}
	let md5 = _bmap.MD5Hash;
	let difficultyname = _bmap.DifficultyName;
	let stars = _bmap.StarRating;
	let accuracy = score.Accuracy;
	return `${md5} ${round_fixed(accuracy, 2)} ${score.Mods} ${title} [${difficultyname}] ${round_fixed(stars, 1)} stars.`;
}
//const beatmaps = realm.objects('Beatmap');
function mods_to_type_key(mods) {
	if (mods === null || mods === undefined || mods === '') {
		return '';
	}
	let pmods = JSON.parse(mods);
	if (! Array.isArray(pmods) ) {
		throw `mods not an array: ${mods}`;
	}

	let found = new Set();
	for (let i = 0; i < pmods.length; i++) {
		let mod = pmods[i];
		let ac = mod['acronym'] ?? '';

		if (ac === '') {
			throw `no acronym??: ${JSON.stringify(mod)} from: ${pmods}`;
		}
		let uac = ac.toUpperCase();
		if (uac !== ac) {
			console.log(`\n\n\x1b[1;31mERROR:\n   I did not account for case-sensitivity, but we got a mod: ${JSON.stringify(ac)} from: ${pmods}`);
		}
		if (mod_acronyms_to_check.has(uac)) {
			//console.log(`push ${a} to ${JSON.stringify(found)}`)
			found.add(uac);
		}
	}
	return Array.from(found).sort().join('');
}

function fill_accuracy_array(scores, separate_perfect, ret) {
	ret = ret ?? new Array();
	scores = Object.values(scores);
	if (scores.length < 1) {
		return ret;
	}
	separate_perfect = separate_perfect ?? false;

	Object.values(scores).forEach((score) => {
		let accuracy = score.Accuracy;
		if (typeof(accuracy) !== 'number' || accuracy < 0 || accuracy > 1) {
			throw 'Invalid accuracy: ' + accuracy + ' on the score last printed.' + format_score(score);
		}
		if (!separate_perfect || accuracy < 1) {
			ret.push(accuracy);
		}
	});
	return ret;
}

function format_accuracy(accuracy, n) {
	if (accuracy >= 1) {
		return '999perfect';
	}
	n = n ?? 4;
	let retn = Math.round(accuracy*1000) / 10;
	retn = (retn > 99.9) ? 99.9 : retn;
	let ret = String(retn);
	if (retn % 1 == 0) {
		while (ret.length < n-2) {
			ret = '0' + ret;
		}
		for (let i=n-ret.length; i > 0; i--) {
			ret += ' ';
		}
	}
	while (ret.length < n) {
		ret = '0' + ret;
	}
	//console.log(ret + ' from ' + accuracy);
	return ret;
}

function calc_brackets(accuracies, separate_perfect, type_key) {
	type_key = JSON.stringify(type_key);
	let check_fmt = new Set([format_accuracy(0),]);
	let brackets = {0: new Array()};
	let l = accuracies.length;
	let n = Math.min(l, number_of_brackets - 1);
	if ((separate_perfect??false) && n > 0) {
		check_fmt.add(format_accuracy(1));
		brackets[1] = new Array();
		n -= 1;
	}
	if (n<1) {
		return brackets;
	}


	accuracies.sort();
	accuracies.forEach((accuracy) => {
		if (typeof(accuracy) !== 'number') {
			throw type_key + ' accuracy not a number: '+ JSON.stringify(accuracy);
		}
	});
	let increment = Math.max(1, Math.floor(l / Math.max(1,n)));
	if (verbose) {
		console.log(`${type_key} increment: ${increment} = l:${l} / n:${n}`)
	}
	let edge_increment = increment >> 1;
	if (l < n) {
		throw `n: ${n} l: ${l}`;
	} else if (increment > 1 && n > 1) {
		// highest and lowest brackets will be half the size
		edge_increment = Math.floor(l / Math.max(1, n*2));
		increment = Math.max(1, Math.floor((l-edge_increment*2) / Math.max(1, n-1)));
	}
	let idx = -edge_increment;
	for (let s=1; s <= n; s++) {
		idx = Math.min(idx+increment, l-1);
		if (idx < 0 || idx > l-1) {
			throw `${type_key} got negative idx: ${idx} from increment: ${increment} - edge_icrement: ${edge_increment}, l: ${l}, n: ${n}`;
		}

		let accuracy = accuracies[idx];
		if (verbose) {
			console.log(`${type_key} accuracies[${idx}]:${JSON.stringify(accuracy.toFixed(3))} from increment: ${increment} - edge_icrement: ${edge_increment}, l: ${l}, n: ${n}`);
		}
		if (typeof(accuracy) !== 'number') {
			throw `${type_key} not a number: accuracies[${idx}]: ${JSON.stringify(accuracy)}`;
		}
		let fmt = format_accuracy(accuracy);
		if (check_fmt.has(fmt)) {
			n--;
			console.log(`${type_key} too many accuracies round to ${fmt}% (E.G. ${accuracy}), number of brackets incorrectly reduced to ${n}`);
			continue;
		}
		check_fmt.add(fmt);
		brackets[accuracy] = new Array();
	}
	return brackets;
}

function max_array_item_length(array, verbose) {
	verbose = verbose ?? false;
	return array.reduce((ret, a) => {
		let l = a.length;
		if (typeof(l) !== 'number') {
			throw `${l} is ${typeof(l)} instead of number`;
		}
		if (verbose) {
			console.log(`Trying ${l} len ${a}`);
		}
		return ret < l ? l : ret;
	}, 1);
}

function prune_empty_collections(collections) {
	Object.entries(collections).forEach(([name, array]) => {
		if (array.length == 0) {
			if (verbose) {
				console.log(`Pruning empty collection ${inv_repr(name)}`);
			}
			delete collections[name];
		}
	});
}

function prettyprint_collections(brackets) {
	let count_pad = String(max_array_item_length(Object.values(brackets))).length;
	let name_pad = max_array_item_length(Object.keys(brackets));
	let total_entries = Object.values(brackets).reduce((ret, a) => ret+a.length, 0);
	Object.entries(brackets).sort().forEach(([name, md5s]) => {
		let l = String(md5s.length).padStart(count_pad);
		let n = name.padEnd(name_pad);
		console.log(`${n} ${l} beatmaps. ${percent_of(md5s.length, total_entries, 1)} of total.`);
	});
}

//throw `${graceperiod_play_count}`
function too_early(beatmap_md5, type_key) {
	if (graceperiod_play_count === 0 || graceperiod_days_count === 0) {
		return false;
	}
	//console.log(`Checking if ${type_key} ${beatmap_md5} is too early.`);
	type_key = type_key ?? '';
	//let ret = false;
	let scores = realm.objects("Score").filtered("BeatmapInfo.MD5Hash == $0 && Date > $1", beatmap_md5, graceperiod_cutoff_date);
	//throw (`${scores.length} scores are after cutoff date ${inv_repr(graceperiod_cutoff_date)}`);
	for (let i=0; i< scores.length; i++) {
		let score = scores[i];
		if (mods_to_type_key(score.Mods) === type_key) {
			if (graceperiod_play_count > 0 && realm.objects("Score").filtered("Date > $0", score.Date).length >= graceperiod_play_count) {
				return false;
			}
			if (verbose) {
				console.log('TOO EARLY!!: ' + format_score(score));
			}
			return true;
		}
	}
	return false;
}

function fill_brackets(brackets, scores, graceperiod_md5s_set, type_key, ret) {
	type_key = type_key ?? '';
	ret = ret ?? new Object();

	Object.entries(brackets).forEach(([accuracy, arr]) => {
		let key = format_accuracy(accuracy);
		if (type_key != '') {
			key = type_key + key;
		}
		if (key in ret) {
			throw 'Double ' + key + ' in ret';
		}
		ret[key] = arr;
	});

	let cutoffs = Object.keys(brackets).sort().reverse();
	Object.entries(scores).forEach(([md5, score]) => {
		if (too_early(md5, type_key)) {
			graceperiod_md5s_set.add(md5);
			return;
		}
		let accuracy = score.Accuracy;
		let added = false;
		for (let i = 0; i < cutoffs.length; i++) {
			let cutoff = cutoffs[i];
			if (accuracy >= cutoff) {
				brackets[cutoff].push(md5);
				added = true;
				break;
			}
		}
		if (!added) {
			throw 'Score too weak for any bracket! ' + format_score(score);
		}
	});
	return ret;
}

function sum_array(arr) {
	return arr.reduce((ret, a) => ret+a, 0);
}

function percent_of(a, b, decimals) {
	return (a*100/b).toFixed(decimals) + '%';
}

function fill_collections(realm, collections) {
	collections = collections ?? new Object();
	let ignored_mod_combinations = new Object();
	let best_scores_by_type_key = new Object();
	mod_combinations.forEach((type_key) => best_scores_by_type_key[type_key] = new Object());
	let total_number_of_scores = 0;
	realm.objects('Score').forEach((score) => {
		total_number_of_scores++;
		let type_key = mods_to_type_key(score.Mods);
		if (! mod_combinations.has(type_key)) {
			if (type_key in ignored_mod_combinations) {
				ignored_mod_combinations[type_key] = 1;
			} else {
				ignored_mod_combinations[type_key] += 1;
			}
			return;
		}
		let best_scores = best_scores_by_type_key[type_key];
		let md5 = score.BeatmapInfo.MD5Hash;
		if (md5 in best_scores) {
			if (best_scores[md5].Accuracy >= score.Accuracy) {
				return;
			}
		}
		best_scores[md5] = score;
	});

	let graceperiod_md5s_set = new Set();
	Object.entries(best_scores_by_type_key).sort((a,b)=>{a=a[1].length; b=b[1].length; if (a<b) {return 1}; if (a>b){return -1};return 0}).forEach(([type_key, best_scores]) => {
		let scores_count = Object.keys(best_scores).length;
		if (scores_count < 1) {
			console.log(`NO SCORES for mods: ${JSON.stringify(type_key)}`);
			return;
		}
		if (verbose) {
			console.log(`filling brackets for ${scores_count}-map ${JSON.stringify(type_key)}`);
		}
		let tk_accuracies = fill_accuracy_array(best_scores, separate_perfect);
		let tk_brackets = calc_brackets(tk_accuracies, separate_perfect, type_key);
		fill_brackets(tk_brackets, best_scores, graceperiod_md5s_set, type_key, collections);
	});

	if (total_number_of_scores < 1) {
		throw `EMPTY scores in ${JSON.stringify(client_realm_file_path)} I can't do anything.`
	}
	let total_ignored = sum_array(Object.values(ignored_mod_combinations));
	if (total_ignored > 0) {
		let percent = percent_of(total_ignored, total_number_of_scores, 1);
		console.log(`Ignored a total of ${total_ignored} (${percent} of) scores due to them being one of the following unspecified combinations of otherwise specified mods:`);
		Object.entries(ignored_mod_combinations).forEach(([name, num]) => {
			let percent = percent_of(num, total_ignored);
			console.log(`${name}: ${num} (${percent} of ignored)`);
		});
	}

	//console.log()
	//prettyprint_brackets(brackets);
	//console.log()

	//console.log(Object.keys(brackets));

	collections['graceperiod'] = Array.from(graceperiod_md5s_set);
	// delete graceperiod_md5s_set;
	//prettyprint_collections(collections);
	//prune_empty_collections(collections);
	return collections;
}

const { UUID } = Realm.BSON;
function write_collections(collections, realm) {
	if (Object.keys(collections).length < 1) {
		console.log(`No collections to write!`);
		return;
	}
	let count_pad = String(max_array_item_length(Object.values(collections))).length;
	let name_pad = max_array_item_length(Object.keys(collections)) + auto_generated_signature.length;
	let total_entries = Object.values(collections).reduce((ret, a) => ret+a.length, 0);
	realm.write(() => {
		Object.entries(collections).sort().forEach(([raw_name, md5s]) => {
			let name = inv_repr(raw_name) + auto_generated_signature;
			if (md5s.length == 0) {
				console.log(`#Skipping ${'EMPTY'.padStart(count_pad+3)} ${name}`);
				return;
			}
			let l = String(md5s.length).padStart(count_pad);
			console.log(`Writing ${l}-item ${name.padEnd(name_pad)}${String(percent_of(md5s.length, total_entries)).padStart(4)}`);
			realm.create('BeatmapCollection', {
				ID: new UUID(),
				Name: name,
				BeatmapMD5Hashes: md5s,
				LastModified: new Date(),
			});
		});
	});
}

let collections = fill_collections(realm);

if (args.read_only) {
	prettyprint_collections(collections);
	console.log(`\x1b[1;37mREAD ONLY\x1b[m, not writing to db`);
} else {
	delete_rename_old(realm)
	write_collections(collections, realm);
}

realm.close();
process.exit(0);

