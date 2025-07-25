#!/usr/bin/env node

const chalk = require('chalk')

const path = require('path')
const ora = require('ora');
const { performance } = require('perf_hooks')
const figlet = require("figlet");
const commander = require('commander');
const program = new commander.Command();

console.log(figlet.textSync("Task Manager"));

function infoParser(arg, res) {
	const values = arg.split('=')
	res[values[0]] = values[1]
	return res
}

program
	.option('-t, --tasks <string...>', 'Specify custom tasks')
	.option('-i, --info <string...>', 'Specify info', infoParser, {})
	.option('-s, --strict', 'Specify if it should be strict or not', false);

program.parse(process.argv);
const options = program.opts();
global.info = program.info;

const runFile = process.argv[2];
const Tasks = require(path.join(process.cwd(), runFile));

let errors = 0;

(async () => {
	if (options.tasks == null || options.tasks?.length === 0) {
		executeTasksGroup('default', Tasks.default)
	} else {
		for (let taskName of options.tasks) {
			if (Tasks[taskName] == null) {
				console.log(chalk.red(`Error, any task by name <${taskName}> was found`))
				process.exit(1)
			}
			await executeTasksGroup(taskName, Tasks[taskName])
		}
	}
})();

async function executeTasksGroup(tasksName, tasksGroup) {
	console.log(chalk.magenta(`\n [${tasksName}] \n`))
	await runTasks(tasksGroup, '', 0)
	if (errors > 0) {
		console.log(chalk.red(`\n Finished with ${errors} ${errors === 1 ? 'error' : 'errors'}. \n`))
	} else {
		console.log(chalk.green(`\n Finished with 0 errors. \n`))
	}
}

async function runTasks(tasks, prefix, level) {
	for (let i = 0; i < tasks.length; i++) {
		const task = tasks[i]
		await new Promise((resolve, reject) => {

			const get_prefix = (loading = false) => {
				if (level > 0) return `${loading ? '' : '  '}${prefix}`
				else return `${loading ? '' : '  '}`
			}

			const get_time = (endingPoint) => {
				return `${(endingPoint - startingPoint).toFixed(0)}ms`
			}

			const respond = async (res = true, err) => {

				let endingPoint = performance.now()

				if (res === true) {
					spinner.stopAndPersist()
					console.log(chalk.green(`${get_prefix(false)} ↳✅ Success in ${task.name} (${get_time(endingPoint)})`))
					resolve()
				} else if (res === false) {
					spinner.stopAndPersist()
					console.log(chalk.red(`${get_prefix(false)} ↳❌ Error in ${task.name} (${get_time(endingPoint)})`))
					if (err) {
						console.log(chalk.red(`${get_prefix()} ↳❌ ${err}`))
						if (program.strict) {
							console.log(chalk.red(`\n Exited.`))
							process.exit(1)
						}
					}
					errors++
					resolve()
				} else if (Array.isArray(res)) {
					spinner.stopAndPersist()
					await runTasks(res, `${prefix}  `, level + 1)
					resolve()
				} else if (res === 'pass') {
					spinner.stop()
					resolve()
				} else if (res === 'watch') {
					spinner.stopAndPersist()
					console.log(chalk.cyan(`${get_prefix(false)} ↳✨ Watching in ${task.name}`))
				} else {
					resolve()
				}
			}


			let startingPoint = performance.now()

			let spinner = ora({
				text: chalk.blue(`${get_prefix(true)}:: ${task.name}`)
			}).start()

			const wrapper = {
				watch() {
					respond('watch')
				},
				pass() {
					respond('pass')
				},
				use({ connect }) {
					connect(wrapper)
				},
				next(result) {
					respond(result)
				},
				print(...arguments) {
					arguments.forEach(arg => {
						console.log(`${get_prefix(false)}${arg}`)
					})
				},
				error(errorMessage) {
					respond(false, errorMessage)
				}
			}

			try {
				const funcResult = task.bind(wrapper)(respond)
				if (Array.isArray(funcResult)) respond(funcResult)
			} catch (err) {
				respond(false, err)
			}
		})
	}
}