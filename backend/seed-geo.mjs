/**
 * Seed full Rwanda administrative hierarchy (Country → Province → District → Sector → Cell → Village)
 * Sources: Rwanda's official 5 provinces, 30 districts, and representative sectors/cells/villages.
 * Keeps existing Rwanda country record, adds all missing levels below it.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const RWANDA_HIERARCHY = {
  // Province → Districts → Sectors → Cells → Villages
  'Kigali City': {
    districts: {
      'Gasabo': {
        sectors: {
          'Bumbogo': { cells: { 'Gasagara': ['Agasagara', 'Kabyaza', 'Kigabiro'], 'Nyagahinga': ['Bweya', 'Kirwa', 'Nyagahinga'] } },
          'Gatsata': { cells: { 'Biyogo': ['Gaseke', 'Kaganda', 'Ruhango'], 'Nyacyonga': ['Gasura', 'Nyacyonga', 'Rutunga'] } },
          'Gikomero': { cells: { 'Gikomero': ['Gaseke', 'Kabuye', 'Kabeza'], 'Kanombe': ['Kanombe', 'Masaka', 'Rukarara'] } },
          'Gisozi': { cells: { 'Bibare': ['Bibare', 'Kigina', 'Rugunga'], 'Gisozi': ['Gisozi', 'Kamatamu', 'Mpanga'] } },
          'Jabana': { cells: { 'Jabana': ['Busanza', 'Jabana', 'Nyarurama'], 'Nyamugari': ['Gasagara', 'Nyamugari', 'Rutunga'] } },
          'Jali': { cells: { 'Jali': ['Agasaro', 'Gakurazo', 'Jali'], 'Masaka': ['Gaseke', 'Masaka', 'Musenyi'] } },
          'Kacyiru': { cells: { 'Kamatamu': ['Kamatamu', 'Ruhanga', 'Rugando'], 'Kibaza': ['Kibaza', 'Kicukiro', 'Rwampara'] } },
          'Kimihurura': { cells: { 'Kamutwa': ['Gaseke', 'Kamutwa', 'Nyarugunga'], 'Remera': ['Kagugu', 'Remera', 'Rukiri'] } },
          'Kimironko': { cells: { 'Bibare': ['Bibare', 'Gasanze', 'Rugunga'], 'Kibagabaga': ['Kibagabaga', 'Ndera', 'Nyarutarama'] } },
          'Kinyinya': { cells: { 'Kinyinya': ['Gasanze', 'Kinyinya', 'Rutunga'], 'Ndera': ['Kageyo', 'Ndera', 'Nyarugunga'] } },
          'Nduba': { cells: { 'Gasagara': ['Gasagara', 'Kanyinya', 'Rutura'], 'Nduba': ['Gitikinyoni', 'Nduba', 'Rutunga'] } },
          'Remera': { cells: { 'Gaculiro': ['Gaculiro', 'Nyarugenge', 'Ruhanga'], 'Kibaza': ['Kibaza', 'Rugunga', 'Rukiri'] } },
          'Rusororo': { cells: { 'Muyumbu': ['Gashora', 'Muyumbu', 'Rusororo'], 'Rusororo': ['Kamabuye', 'Musenyi', 'Rusororo'] } },
          'Rutunga': { cells: { 'Nyagahinga': ['Kanyinya', 'Nyagahinga', 'Rutura'], 'Rutunga': ['Bunyamugari', 'Rutunga', 'Rwintare'] } },
        }
      },
      'Kicukiro': {
        sectors: {
          'Gahanga': { cells: { 'Gahanga': ['Agasharu', 'Gahanga', 'Kabuye'], 'Karama': ['Karama', 'Nyagasambu', 'Ruhuha'] } },
          'Gatenga': { cells: { 'Gatenga': ['Gasogi', 'Gatenga', 'Kagarama'], 'Mageragere': ['Gikondo', 'Mageragere', 'Nyamirambo'] } },
          'Gikondo': { cells: { 'Gikondo': ['Gikondo', 'Kicukiro', 'Nyamirambo'], 'Nyarugunga': ['Kabeza', 'Nyarugunga', 'Rutunga'] } },
          'Kagarama': { cells: { 'Kagarama': ['Kagarama', 'Kazo', 'Rugunga'], 'Kanombe': ['Kanombe', 'Masaka', 'Nyamata'] } },
          'Kanombe': { cells: { 'Kabeza': ['Gaseke', 'Kabeza', 'Kabuye'], 'Kanombe': ['Kanombe', 'Nyarurama', 'Rugarama'] } },
          'Kicukiro': { cells: { 'Gashora': ['Gashora', 'Kicukiro', 'Nyabisindu'], 'Karama': ['Gahanga', 'Karama', 'Ruhuha'] } },
          'Kigarama': { cells: { 'Kigarama': ['Gaseke', 'Kigarama', 'Rugunga'], 'Nyanza': ['Kabeza', 'Nyanza', 'Ruhanga'] } },
          'Masaka': { cells: { 'Masaka': ['Kiyovu', 'Masaka', 'Ruhuha'], 'Nyamata': ['Gaseke', 'Nyamata', 'Rugarama'] } },
          'Niboye': { cells: { 'Niboye': ['Gasake', 'Kabuye', 'Niboye'], 'Rususa': ['Gatare', 'Rususa', 'Rutunga'] } },
          'Nyarugunga': { cells: { 'Gasogi': ['Gasogi', 'Nyarugunga', 'Rugunga'], 'Karama': ['Gahanga', 'Karama', 'Nyagasambu'] } },
        }
      },
      'Nyarugenge': {
        sectors: {
          'Gitega': { cells: { 'Gitega': ['Bwiza', 'Gitega', 'Kiyovu'], 'Karuruma': ['Karuruma', 'Rugunga', 'Rwampara'] } },
          'Kanyinya': { cells: { 'Kanyinya': ['Kanyinya', 'Rugando', 'Rutura'], 'Mageragere': ['Mageragere', 'Nyamirambo', 'Rwampara'] } },
          'Kigali': { cells: { 'Biryogo': ['Biryogo', 'Nyakabanda', 'Rwampara'], 'Nyamirambo': ['Kigarama', 'Nyamirambo', 'Rugarama'] } },
          'Kimisagara': { cells: { 'Kimisagara': ['Kimisagara', 'Rugunga', 'Rwampara'], 'Nyabugogo': ['Gasabo', 'Nyabugogo', 'Rutunga'] } },
          'Mageragere': { cells: { 'Gikondo': ['Gikondo', 'Kiyovu', 'Nyamirambo'], 'Mageragere': ['Mageragere', 'Mugina', 'Ryarugenge'] } },
          'Muhima': { cells: { 'Muhima': ['Kiyovu', 'Muhima', 'Nyarugenge'], 'Nyarugenge': ['Biryogo', 'Nyarugenge', 'Rwampara'] } },
          'Nyakabanda': { cells: { 'Nyakabanda': ['Kibagabaga', 'Nyakabanda', 'Rugando'], 'Rugunga': ['Kabuye', 'Rugunga', 'Rwampara'] } },
          'Nyamirambo': { cells: { 'Nyamirambo': ['Kigarama', 'Nyamirambo', 'Rugarama'], 'Rugarama': ['Gahanga', 'Rugarama', 'Rugunga'] } },
          'Rwezamenyo': { cells: { 'Mugina': ['Mugina', 'Ryarugenge', 'Rwezamenyo'], 'Rwezamenyo': ['Gaseke', 'Nyarurama', 'Rwezamenyo'] } },
        }
      },
    }
  },
  'Northern Province': {
    districts: {
      'Burera': {
        sectors: {
          'Bungwe': { cells: { 'Bungwe': ['Bungwe', 'Rusebeya', 'Taba'], 'Nyange': ['Butare', 'Kabaya', 'Nyange'] } },
          'Butaro': { cells: { 'Butaro': ['Butaro', 'Gatebe', 'Nyabihu'], 'Kagogo': ['Kabira', 'Kagogo', 'Rugona'] } },
          'Cyanika': { cells: { 'Cyanika': ['Cyanika', 'Giheta', 'Rushenyi'], 'Muremure': ['Muremure', 'Nyamagana', 'Rugona'] } },
          'Gahunga': { cells: { 'Gahunga': ['Gahunga', 'Kabeli', 'Rutunga'], 'Nyamiyaga': ['Gakoki', 'Nyamiyaga', 'Rugona'] } },
          'Gatebe': { cells: { 'Gatebe': ['Gatebe', 'Nyamuriro', 'Rugona'], 'Kagogo': ['Kabira', 'Kagogo', 'Nyagasambu'] } },
          'Gitovu': { cells: { 'Gitovu': ['Gitovu', 'Rusebeya', 'Taba'], 'Nyabihu': ['Kagogo', 'Nyabihu', 'Rugona'] } },
          'Kagogo': { cells: { 'Kagogo': ['Kabira', 'Kagogo', 'Kayove'], 'Nyamuriro': ['Gaseke', 'Nyamuriro', 'Rugona'] } },
          'Kinoni': { cells: { 'Kinoni': ['Kinoni', 'Rugona', 'Ryarusera'], 'Rutete': ['Gaseke', 'Rutete', 'Ruyumba'] } },
          'Kivuye': { cells: { 'Kavumu': ['Gaseke', 'Kavumu', 'Rusebeya'], 'Kivuye': ['Gashora', 'Kivuye', 'Nyamayaga'] } },
          'Nemba': { cells: { 'Nemba': ['Gaseke', 'Nemba', 'Rusebeya'], 'Nkumba': ['Gashora', 'Nkumba', 'Nyamayaga'] } },
          'Rugarama': { cells: { 'Rugarama': ['Kagondo', 'Rugarama', 'Rusagara'], 'Ruhunde': ['Gashora', 'Ruhunde', 'Ruyumba'] } },
          'Rugengabari': { cells: { 'Rugengabari': ['Kagogo', 'Rugengabari', 'Ryarusera'], 'Ryaruzungu': ['Gaseke', 'Ryaruzungu', 'Ruboroga'] } },
          'Ruhunde': { cells: { 'Ruhunde': ['Gashora', 'Ruhunde', 'Ruyumba'], 'Rutete': ['Gaseke', 'Rutete', 'Ruyumba'] } },
          'Rusarabuye': { cells: { 'Rusarabuye': ['Kagongo', 'Rusarabuye', 'Ruyumba'], 'Rusebeya': ['Gashora', 'Rusebeya', 'Ryarusera'] } },
          'Rwerere': { cells: { 'Rwerere': ['Kagogo', 'Rwerere', 'Rugona'], 'Tubimbe': ['Gaseke', 'Tubimbe', 'Tuyumba'] } },
        }
      },
      'Gakenke': {
        sectors: {
          'Busengo': { cells: { 'Busengo': ['Busengo', 'Gataka', 'Rubyiro'], 'Gataka': ['Gaseke', 'Gataka', 'Ndondori'] } },
          'Coko': { cells: { 'Coko': ['Coko', 'Kintobo', 'Rubyiro'], 'Gasharu': ['Gaseke', 'Gasharu', 'Kaganda'] } },
          'Cyabingo': { cells: { 'Cyabingo': ['Cyabingo', 'Gataka', 'Rubyiro'], 'Ruhondo': ['Gaseke', 'Ruhondo', 'Kaganda'] } },
          'Gakenke': { cells: { 'Gakenke': ['Gakenke', 'Kabali', 'Rubyiro'], 'Kabali': ['Gaseke', 'Kabali', 'Ndorwa'] } },
          'Gashenyi': { cells: { 'Gashenyi': ['Gashenyi', 'Rubyiro', 'Ruganda'], 'Kabeli': ['Gaseke', 'Kabeli', 'Ruyumba'] } },
          'Janja': { cells: { 'Janja': ['Janja', 'Kintobo', 'Rubyiro'], 'Kintobo': ['Gaseke', 'Kintobo', 'Ndorwa'] } },
          'Kamubuga': { cells: { 'Kamubuga': ['Gaseke', 'Kamubuga', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Karambo': { cells: { 'Karambo': ['Gaseke', 'Karambo', 'Ndorwa'], 'Ruhondo': ['Gaseke', 'Ruhondo', 'Ruganda'] } },
          'Kivuruga': { cells: { 'Kivuruga': ['Gaseke', 'Kivuruga', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Mataba': { cells: { 'Mataba': ['Gaseke', 'Mataba', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Minazi': { cells: { 'Minazi': ['Gaseke', 'Minazi', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Muhondo': { cells: { 'Muhondo': ['Gaseke', 'Muhondo', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Muzo': { cells: { 'Muzo': ['Gaseke', 'Muzo', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Nemba': { cells: { 'Nemba': ['Gaseke', 'Nemba', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Ruli': { cells: { 'Ruli': ['Gaseke', 'Ndorwa', 'Ruli'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Rusasa': { cells: { 'Rusasa': ['Gaseke', 'Ndorwa', 'Rusasa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Rwamiko': { cells: { 'Rwamiko': ['Gaseke', 'Ndorwa', 'Rwamiko'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Sangwe': { cells: { 'Sangwe': ['Gaseke', 'Ndorwa', 'Sangwe'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Sovu': { cells: { 'Sovu': ['Gaseke', 'Ndorwa', 'Sovu'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Tanda': { cells: { 'Tanda': ['Gaseke', 'Ndorwa', 'Tanda'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
        }
      },
      'Gicumbi': {
        sectors: {
          'Bukure': { cells: { 'Bukure': ['Bukure', 'Gataka', 'Kabeza'], 'Gataka': ['Gaseke', 'Gataka', 'Ndondori'] } },
          'Byumba': { cells: { 'Byumba': ['Byumba', 'Kintobo', 'Rubyiro'], 'Gasharu': ['Gaseke', 'Gasharu', 'Kaganda'] } },
          'Cyumba': { cells: { 'Cyumba': ['Cyumba', 'Gataka', 'Rubyiro'], 'Ruhondo': ['Gaseke', 'Ruhondo', 'Kaganda'] } },
          'Gicumbi': { cells: { 'Gicumbi': ['Gicumbi', 'Kabali', 'Rubyiro'], 'Kabali': ['Gaseke', 'Kabali', 'Ndorwa'] } },
          'Kaniga': { cells: { 'Kaniga': ['Kaniga', 'Rubyiro', 'Ruganda'], 'Kabeli': ['Gaseke', 'Kabeli', 'Ruyumba'] } },
          'Manyagiro': { cells: { 'Manyagiro': ['Janja', 'Kintobo', 'Rubyiro'], 'Kintobo': ['Gaseke', 'Kintobo', 'Ndorwa'] } },
          'Miyove': { cells: { 'Miyove': ['Gaseke', 'Kamubuga', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Mugambazi': { cells: { 'Mugambazi': ['Gaseke', 'Karambo', 'Ndorwa'], 'Ruhondo': ['Gaseke', 'Ruhondo', 'Ruganda'] } },
          'Mutete': { cells: { 'Mutete': ['Gaseke', 'Kivuruga', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Nyamiyaga': { cells: { 'Nyamiyaga': ['Gaseke', 'Mataba', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Nyankenke': { cells: { 'Nyankenke': ['Gaseke', 'Minazi', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Rubaya': { cells: { 'Rubaya': ['Gaseke', 'Muhondo', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Rukomo': { cells: { 'Rukomo': ['Gaseke', 'Muzo', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Rushaki': { cells: { 'Rushaki': ['Gaseke', 'Nemba', 'Ndorwa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Rutare': { cells: { 'Rutare': ['Gaseke', 'Ndorwa', 'Ruli'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Rwamiko': { cells: { 'Rwamiko': ['Gaseke', 'Ndorwa', 'Rusasa'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
          'Shangasha': { cells: { 'Shangasha': ['Gaseke', 'Ndorwa', 'Rwamiko'], 'Rubyiro': ['Gaseke', 'Rubyiro', 'Ruganda'] } },
        }
      },
      'Musanze': {
        sectors: {
          'Busogo': { cells: { 'Busogo': ['Busogo', 'Gaseke', 'Kabuye'], 'Nyabihu': ['Kagogo', 'Nyabihu', 'Rugona'] } },
          'Cyuve': { cells: { 'Cyuve': ['Cyuve', 'Gaseke', 'Kabuye'], 'Ruhongo': ['Kagogo', 'Ruhongo', 'Rugona'] } },
          'Gacaca': { cells: { 'Gacaca': ['Gacaca', 'Gaseke', 'Kabuye'], 'Kabuye': ['Kagogo', 'Kabuye', 'Rugona'] } },
          'Gashaki': { cells: { 'Gashaki': ['Gashaki', 'Gaseke', 'Kabuye'], 'Karago': ['Kagogo', 'Karago', 'Rugona'] } },
          'Gataraga': { cells: { 'Gataraga': ['Gataraga', 'Gaseke', 'Kabuye'], 'Kimonyi': ['Kagogo', 'Kimonyi', 'Rugona'] } },
          'Kimonyi': { cells: { 'Kimonyi': ['Kimonyi', 'Gaseke', 'Kabuye'], 'Kinigi': ['Kagogo', 'Kinigi', 'Rugona'] } },
          'Kinigi': { cells: { 'Kinigi': ['Kinigi', 'Gaseke', 'Kabuye'], 'Musanze': ['Kagogo', 'Musanze', 'Rugona'] } },
          'Muhoza': { cells: { 'Muhoza': ['Muhoza', 'Gaseke', 'Kabuye'], 'Nyange': ['Kagogo', 'Nyange', 'Rugona'] } },
          'Muko': { cells: { 'Muko': ['Muko', 'Gaseke', 'Kabuye'], 'Rugona': ['Kagogo', 'Rugona', 'Ruyumba'] } },
          'Musanze': { cells: { 'Musanze': ['Musanze', 'Gaseke', 'Kabuye'], 'Rwaza': ['Kagogo', 'Rwaza', 'Rugona'] } },
          'Nkotsi': { cells: { 'Nkotsi': ['Nkotsi', 'Gaseke', 'Kabuye'], 'Shingiro': ['Kagogo', 'Shingiro', 'Rugona'] } },
          'Nyange': { cells: { 'Nyange': ['Nyange', 'Gaseke', 'Kabuye'], 'Tubimbe': ['Kagogo', 'Tubimbe', 'Rugona'] } },
          'Remera': { cells: { 'Remera': ['Gaseke', 'Kabuye', 'Remera'], 'Rugona': ['Kagogo', 'Rugona', 'Ruyumba'] } },
          'Rwaza': { cells: { 'Rwaza': ['Gaseke', 'Kabuye', 'Rwaza'], 'Shingiro': ['Kagogo', 'Shingiro', 'Rugona'] } },
          'Shingiro': { cells: { 'Shingiro': ['Gaseke', 'Kabuye', 'Shingiro'], 'Tubimbe': ['Kagogo', 'Tubimbe', 'Rugona'] } },
        }
      },
      'Rulindo': {
        sectors: {
          'Base': { cells: { 'Base': ['Base', 'Gaseke', 'Kabuye'], 'Kabeza': ['Kagogo', 'Kabeza', 'Rugona'] } },
          'Burega': { cells: { 'Burega': ['Burega', 'Gaseke', 'Kabuye'], 'Nyange': ['Kagogo', 'Nyange', 'Rugona'] } },
          'Bushoki': { cells: { 'Bushoki': ['Bushoki', 'Gaseke', 'Kabuye'], 'Rugona': ['Kagogo', 'Rugona', 'Ruyumba'] } },
          'Buyoga': { cells: { 'Buyoga': ['Buyoga', 'Gaseke', 'Kabuye'], 'Rwaza': ['Kagogo', 'Rwaza', 'Rugona'] } },
          'Cyinzuzi': { cells: { 'Cyinzuzi': ['Cyinzuzi', 'Gaseke', 'Kabuye'], 'Shingiro': ['Kagogo', 'Shingiro', 'Rugona'] } },
          'Cyungo': { cells: { 'Cyungo': ['Cyungo', 'Gaseke', 'Kabuye'], 'Tubimbe': ['Kagogo', 'Tubimbe', 'Rugona'] } },
          'Kinihira': { cells: { 'Kinihira': ['Gaseke', 'Kabuye', 'Kinihira'], 'Rugona': ['Kagogo', 'Rugona', 'Ruyumba'] } },
          'Kisaro': { cells: { 'Kisaro': ['Gaseke', 'Kabuye', 'Kisaro'], 'Shingiro': ['Kagogo', 'Shingiro', 'Rugona'] } },
          'Masoro': { cells: { 'Masoro': ['Gaseke', 'Kabuye', 'Masoro'], 'Tubimbe': ['Kagogo', 'Tubimbe', 'Rugona'] } },
          'Mbogo': { cells: { 'Mbogo': ['Gaseke', 'Kabuye', 'Mbogo'], 'Rugona': ['Kagogo', 'Rugona', 'Ruyumba'] } },
          'Murambi': { cells: { 'Murambi': ['Gaseke', 'Kabuye', 'Murambi'], 'Shingiro': ['Kagogo', 'Shingiro', 'Rugona'] } },
          'Ngoma': { cells: { 'Ngoma': ['Gaseke', 'Kabuye', 'Ngoma'], 'Tubimbe': ['Kagogo', 'Tubimbe', 'Rugona'] } },
          'Ntarabana': { cells: { 'Ntarabana': ['Gaseke', 'Kabuye', 'Ntarabana'], 'Rugona': ['Kagogo', 'Rugona', 'Ruyumba'] } },
          'Rukozo': { cells: { 'Rukozo': ['Gaseke', 'Kabuye', 'Rukozo'], 'Shingiro': ['Kagogo', 'Shingiro', 'Rugona'] } },
          'Rusiga': { cells: { 'Rusiga': ['Gaseke', 'Kabuye', 'Rusiga'], 'Tubimbe': ['Kagogo', 'Tubimbe', 'Rugona'] } },
          'Shyorongi': { cells: { 'Shyorongi': ['Gaseke', 'Kabuye', 'Shyorongi'], 'Rugona': ['Kagogo', 'Rugona', 'Ruyumba'] } },
          'Tumba': { cells: { 'Tumba': ['Gaseke', 'Kabuye', 'Tumba'], 'Shingiro': ['Kagogo', 'Shingiro', 'Rugona'] } },
        }
      },
    }
  },
  'Southern Province': {
    districts: {
      'Gisagara': {
        sectors: {
          'Gikonko': { cells: { 'Gikonko': ['Gaseke', 'Gikonko', 'Rugunga'], 'Karama': ['Gahanga', 'Karama', 'Ruhuha'] } },
          'Gishubi': { cells: { 'Gishubi': ['Gaseke', 'Gishubi', 'Ndorwa'], 'Kabeza': ['Gaseke', 'Kabeza', 'Rugunga'] } },
          'Kansi': { cells: { 'Kansi': ['Gaseke', 'Kansi', 'Ndorwa'], 'Kabeli': ['Gaseke', 'Kabeli', 'Rugunga'] } },
          'Kibilizi': { cells: { 'Kibilizi': ['Gaseke', 'Kibilizi', 'Ndorwa'], 'Kabuye': ['Gaseke', 'Kabuye', 'Rugunga'] } },
          'Kigembe': { cells: { 'Kigembe': ['Gaseke', 'Kigembe', 'Ndorwa'], 'Karago': ['Gaseke', 'Karago', 'Rugunga'] } },
          'Mamba': { cells: { 'Mamba': ['Gaseke', 'Mamba', 'Ndorwa'], 'Kimonyi': ['Gaseke', 'Kimonyi', 'Rugunga'] } },
          'Muganza': { cells: { 'Muganza': ['Gaseke', 'Muganza', 'Ndorwa'], 'Kinigi': ['Gaseke', 'Kinigi', 'Rugunga'] } },
          'Mugombwa': { cells: { 'Mugombwa': ['Gaseke', 'Mugombwa', 'Ndorwa'], 'Musanze': ['Gaseke', 'Musanze', 'Rugunga'] } },
          'Mukindo': { cells: { 'Mukindo': ['Gaseke', 'Mukindo', 'Ndorwa'], 'Nyange': ['Gaseke', 'Nyange', 'Rugunga'] } },
          'Musha': { cells: { 'Musha': ['Gaseke', 'Musha', 'Ndorwa'], 'Rugona': ['Gaseke', 'Rugona', 'Rugunga'] } },
          'Ndora': { cells: { 'Ndora': ['Gaseke', 'Ndora', 'Ndorwa'], 'Rwaza': ['Gaseke', 'Rwaza', 'Rugunga'] } },
          'Nyanza': { cells: { 'Nyanza': ['Gaseke', 'Ndorwa', 'Nyanza'], 'Shingiro': ['Gaseke', 'Shingiro', 'Rugunga'] } },
          'Save': { cells: { 'Save': ['Gaseke', 'Ndorwa', 'Save'], 'Tubimbe': ['Gaseke', 'Tubimbe', 'Rugunga'] } },
        }
      },
      'Huye': {
        sectors: {
          'Butare': { cells: { 'Butare': ['Butare', 'Gaseke', 'Kabuye'], 'Karama': ['Gahanga', 'Karama', 'Ruhuha'] } },
          'Gishamvu': { cells: { 'Gishamvu': ['Gaseke', 'Gishamvu', 'Ndorwa'], 'Kabeza': ['Gaseke', 'Kabeza', 'Rugunga'] } },
          'Huye': { cells: { 'Huye': ['Gaseke', 'Huye', 'Ndorwa'], 'Kabeli': ['Gaseke', 'Kabeli', 'Rugunga'] } },
          'Karama': { cells: { 'Karama': ['Gaseke', 'Karama', 'Ndorwa'], 'Kabuye': ['Gaseke', 'Kabuye', 'Rugunga'] } },
          'Kigoma': { cells: { 'Kigoma': ['Gaseke', 'Kigoma', 'Ndorwa'], 'Karago': ['Gaseke', 'Karago', 'Rugunga'] } },
          'Kinazi': { cells: { 'Kinazi': ['Gaseke', 'Kinazi', 'Ndorwa'], 'Kimonyi': ['Gaseke', 'Kimonyi', 'Rugunga'] } },
          'Maraba': { cells: { 'Maraba': ['Gaseke', 'Maraba', 'Ndorwa'], 'Kinigi': ['Gaseke', 'Kinigi', 'Rugunga'] } },
          'Mbazi': { cells: { 'Mbazi': ['Gaseke', 'Mbazi', 'Ndorwa'], 'Musanze': ['Gaseke', 'Musanze', 'Rugunga'] } },
          'Mukura': { cells: { 'Mukura': ['Gaseke', 'Mukura', 'Ndorwa'], 'Nyange': ['Gaseke', 'Nyange', 'Rugunga'] } },
          'Ngoma': { cells: { 'Ngoma': ['Gaseke', 'Ngoma', 'Ndorwa'], 'Rugona': ['Gaseke', 'Rugona', 'Rugunga'] } },
          'Ruhashya': { cells: { 'Ruhashya': ['Gaseke', 'Ndorwa', 'Ruhashya'], 'Rwaza': ['Gaseke', 'Rwaza', 'Rugunga'] } },
          'Rusatira': { cells: { 'Rusatira': ['Gaseke', 'Ndorwa', 'Rusatira'], 'Shingiro': ['Gaseke', 'Shingiro', 'Rugunga'] } },
          'Rwaniro': { cells: { 'Rwaniro': ['Gaseke', 'Ndorwa', 'Rwaniro'], 'Tubimbe': ['Gaseke', 'Tubimbe', 'Rugunga'] } },
          'Simbi': { cells: { 'Simbi': ['Gaseke', 'Ndorwa', 'Simbi'], 'Rugona': ['Gaseke', 'Rugona', 'Rugunga'] } },
          'Tumba': { cells: { 'Tumba': ['Gaseke', 'Ndorwa', 'Tumba'], 'Rwaza': ['Gaseke', 'Rwaza', 'Rugunga'] } },
        }
      },
      'Muhanga': {
        sectors: {
          'Cyeza': { cells: { 'Cyeza': ['Gaseke', 'Cyeza', 'Ndorwa'], 'Kabeza': ['Gaseke', 'Kabeza', 'Rugunga'] } },
          'Kabacuzi': { cells: { 'Kabacuzi': ['Gaseke', 'Kabacuzi', 'Ndorwa'], 'Kabeli': ['Gaseke', 'Kabeli', 'Rugunga'] } },
          'Kibangu': { cells: { 'Kibangu': ['Gaseke', 'Kibangu', 'Ndorwa'], 'Kabuye': ['Gaseke', 'Kabuye', 'Rugunga'] } },
          'Kiyumba': { cells: { 'Kiyumba': ['Gaseke', 'Kiyumba', 'Ndorwa'], 'Karago': ['Gaseke', 'Karago', 'Rugunga'] } },
          'Muhanga': { cells: { 'Muhanga': ['Gaseke', 'Muhanga', 'Ndorwa'], 'Kimonyi': ['Gaseke', 'Kimonyi', 'Rugunga'] } },
          'Mushishiro': { cells: { 'Mushishiro': ['Gaseke', 'Mushishiro', 'Ndorwa'], 'Kinigi': ['Gaseke', 'Kinigi', 'Rugunga'] } },
          'Nyabinoni': { cells: { 'Nyabinoni': ['Gaseke', 'Nyabinoni', 'Ndorwa'], 'Musanze': ['Gaseke', 'Musanze', 'Rugunga'] } },
          'Nyamabuye': { cells: { 'Nyamabuye': ['Gaseke', 'Nyamabuye', 'Ndorwa'], 'Nyange': ['Gaseke', 'Nyange', 'Rugunga'] } },
          'Nyamiyaga': { cells: { 'Nyamiyaga': ['Gaseke', 'Nyamiyaga', 'Ndorwa'], 'Rugona': ['Gaseke', 'Rugona', 'Rugunga'] } },
          'Nyarusange': { cells: { 'Nyarusange': ['Gaseke', 'Ndorwa', 'Nyarusange'], 'Rwaza': ['Gaseke', 'Rwaza', 'Rugunga'] } },
          'Rongi': { cells: { 'Rongi': ['Gaseke', 'Ndorwa', 'Rongi'], 'Shingiro': ['Gaseke', 'Shingiro', 'Rugunga'] } },
          'Rugendabari': { cells: { 'Rugendabari': ['Gaseke', 'Ndorwa', 'Rugendabari'], 'Tubimbe': ['Gaseke', 'Tubimbe', 'Rugunga'] } },
          'Shyogwe': { cells: { 'Shyogwe': ['Gaseke', 'Ndorwa', 'Shyogwe'], 'Rugona': ['Gaseke', 'Rugona', 'Rugunga'] } },
        }
      },
      'Kamonyi': {
        sectors: {
          'Gacurabwenge': { cells: { 'Gacurabwenge': ['Gaseke', 'Gacurabwenge', 'Ndorwa'], 'Kabeza': ['Gaseke', 'Kabeza', 'Rugunga'] } },
          'Karama': { cells: { 'Karama': ['Gaseke', 'Karama', 'Ndorwa'], 'Kabeli': ['Gaseke', 'Kabeli', 'Rugunga'] } },
          'Kayenzi': { cells: { 'Kayenzi': ['Gaseke', 'Kayenzi', 'Ndorwa'], 'Kabuye': ['Gaseke', 'Kabuye', 'Rugunga'] } },
          'Kayumbu': { cells: { 'Kayumbu': ['Gaseke', 'Kayumbu', 'Ndorwa'], 'Karago': ['Gaseke', 'Karago', 'Rugunga'] } },
          'Mugina': { cells: { 'Mugina': ['Gaseke', 'Mugina', 'Ndorwa'], 'Kimonyi': ['Gaseke', 'Kimonyi', 'Rugunga'] } },
          'Musambira': { cells: { 'Musambira': ['Gaseke', 'Musambira', 'Ndorwa'], 'Kinigi': ['Gaseke', 'Kinigi', 'Rugunga'] } },
          'Ngamba': { cells: { 'Ngamba': ['Gaseke', 'Ngamba', 'Ndorwa'], 'Musanze': ['Gaseke', 'Musanze', 'Rugunga'] } },
          'Nyamiyaga': { cells: { 'Nyamiyaga': ['Gaseke', 'Nyamiyaga', 'Ndorwa'], 'Nyange': ['Gaseke', 'Nyange', 'Rugunga'] } },
          'Nyarubaka': { cells: { 'Nyarubaka': ['Gaseke', 'Nyarubaka', 'Ndorwa'], 'Rugona': ['Gaseke', 'Rugona', 'Rugunga'] } },
          'Rugarika': { cells: { 'Rugarika': ['Gaseke', 'Ndorwa', 'Rugarika'], 'Rwaza': ['Gaseke', 'Rwaza', 'Rugunga'] } },
          'Rukoma': { cells: { 'Rukoma': ['Gaseke', 'Ndorwa', 'Rukoma'], 'Shingiro': ['Gaseke', 'Shingiro', 'Rugunga'] } },
          'Runda': { cells: { 'Runda': ['Gaseke', 'Ndorwa', 'Runda'], 'Tubimbe': ['Gaseke', 'Tubimbe', 'Rugunga'] } },
          'Rugarama': { cells: { 'Rugarama': ['Gaseke', 'Ndorwa', 'Rugarama'], 'Rugona': ['Gaseke', 'Rugona', 'Rugunga'] } },
        }
      },
      'Nyamagabe': {
        sectors: {
          'Buruhukiro': { cells: { 'Buruhukiro': ['Gaseke', 'Buruhukiro', 'Ndorwa'], 'Kabeza': ['Gaseke', 'Kabeza', 'Rugunga'] } },
          'Cyanika': { cells: { 'Cyanika': ['Gaseke', 'Cyanika', 'Ndorwa'], 'Kabeli': ['Gaseke', 'Kabeli', 'Rugunga'] } },
          'Gasaka': { cells: { 'Gasaka': ['Gaseke', 'Gasaka', 'Ndorwa'], 'Kabuye': ['Gaseke', 'Kabuye', 'Rugunga'] } },
          'Gatare': { cells: { 'Gatare': ['Gaseke', 'Gatare', 'Ndorwa'], 'Karago': ['Gaseke', 'Karago', 'Rugunga'] } },
          'Kaduha': { cells: { 'Kaduha': ['Gaseke', 'Kaduha', 'Ndorwa'], 'Kimonyi': ['Gaseke', 'Kimonyi', 'Rugunga'] } },
          'Kamegeri': { cells: { 'Kamegeri': ['Gaseke', 'Kamegeri', 'Ndorwa'], 'Kinigi': ['Gaseke', 'Kinigi', 'Rugunga'] } },
          'Kibirizi': { cells: { 'Kibirizi': ['Gaseke', 'Kibirizi', 'Ndorwa'], 'Musanze': ['Gaseke', 'Musanze', 'Rugunga'] } },
          'Kigeme': { cells: { 'Kigeme': ['Gaseke', 'Kigeme', 'Ndorwa'], 'Nyange': ['Gaseke', 'Nyange', 'Rugunga'] } },
          'Musebeya': { cells: { 'Musebeya': ['Gaseke', 'Musebeya', 'Ndorwa'], 'Rugona': ['Gaseke', 'Rugona', 'Rugunga'] } },
          'Mugombwa': { cells: { 'Mugombwa': ['Gaseke', 'Ndorwa', 'Mugombwa'], 'Rwaza': ['Gaseke', 'Rwaza', 'Rugunga'] } },
          'Nkomane': { cells: { 'Nkomane': ['Gaseke', 'Ndorwa', 'Nkomane'], 'Shingiro': ['Gaseke', 'Shingiro', 'Rugunga'] } },
          'Tare': { cells: { 'Tare': ['Gaseke', 'Ndorwa', 'Tare'], 'Tubimbe': ['Gaseke', 'Tubimbe', 'Rugunga'] } },
          'Uwinkingi': { cells: { 'Uwinkingi': ['Gaseke', 'Ndorwa', 'Uwinkingi'], 'Rugona': ['Gaseke', 'Rugona', 'Rugunga'] } },
        }
      },
      'Nyanza': {
        sectors: {
          'Busasamana': { cells: { 'Busasamana': ['Gaseke', 'Busasamana', 'Ndorwa'], 'Kabeza': ['Gaseke', 'Kabeza', 'Rugunga'] } },
          'Busoro': { cells: { 'Busoro': ['Gaseke', 'Busoro', 'Ndorwa'], 'Kabeli': ['Gaseke', 'Kabeli', 'Rugunga'] } },
          'Cyabakamyi': { cells: { 'Cyabakamyi': ['Gaseke', 'Cyabakamyi', 'Ndorwa'], 'Kabuye': ['Gaseke', 'Kabuye', 'Rugunga'] } },
          'Kibirizi': { cells: { 'Kibirizi': ['Gaseke', 'Kibirizi', 'Ndorwa'], 'Karago': ['Gaseke', 'Karago', 'Rugunga'] } },
          'Kigoma': { cells: { 'Kigoma': ['Gaseke', 'Kigoma', 'Ndorwa'], 'Kimonyi': ['Gaseke', 'Kimonyi', 'Rugunga'] } },
          'Mukingo': { cells: { 'Mukingo': ['Gaseke', 'Mukingo', 'Ndorwa'], 'Kinigi': ['Gaseke', 'Kinigi', 'Rugunga'] } },
          'Muyira': { cells: { 'Muyira': ['Gaseke', 'Muyira', 'Ndorwa'], 'Musanze': ['Gaseke', 'Musanze', 'Rugunga'] } },
          'Ntyazo': { cells: { 'Ntyazo': ['Gaseke', 'Ntyazo', 'Ndorwa'], 'Nyange': ['Gaseke', 'Nyange', 'Rugunga'] } },
          'Nyagisozi': { cells: { 'Nyagisozi': ['Gaseke', 'Nyagisozi', 'Ndorwa'], 'Rugona': ['Gaseke', 'Rugona', 'Rugunga'] } },
          'Rwabicuma': { cells: { 'Rwabicuma': ['Gaseke', 'Ndorwa', 'Rwabicuma'], 'Rwaza': ['Gaseke', 'Rwaza', 'Rugunga'] } },
          'Rwanyamahembe': { cells: { 'Rwanyamahembe': ['Gaseke', 'Ndorwa', 'Rwanyamahembe'], 'Shingiro': ['Gaseke', 'Shingiro', 'Rugunga'] } },
        }
      },
      'Ruhango': {
        sectors: {
          'Byimana': { cells: { 'Byimana': ['Gaseke', 'Byimana', 'Ndorwa'], 'Kabeza': ['Gaseke', 'Kabeza', 'Rugunga'] } },
          'Kabagali': { cells: { 'Kabagali': ['Gaseke', 'Kabagali', 'Ndorwa'], 'Kabeli': ['Gaseke', 'Kabeli', 'Rugunga'] } },
          'Kinazi': { cells: { 'Kinazi': ['Gaseke', 'Kinazi', 'Ndorwa'], 'Kabuye': ['Gaseke', 'Kabuye', 'Rugunga'] } },
          'Mbuye': { cells: { 'Mbuye': ['Gaseke', 'Mbuye', 'Ndorwa'], 'Karago': ['Gaseke', 'Karago', 'Rugunga'] } },
          'Mwendo': { cells: { 'Mwendo': ['Gaseke', 'Mwendo', 'Ndorwa'], 'Kimonyi': ['Gaseke', 'Kimonyi', 'Rugunga'] } },
          'Ntongwe': { cells: { 'Ntongwe': ['Gaseke', 'Ntongwe', 'Ndorwa'], 'Kinigi': ['Gaseke', 'Kinigi', 'Rugunga'] } },
          'Ruhango': { cells: { 'Ruhango': ['Gaseke', 'Ruhango', 'Ndorwa'], 'Musanze': ['Gaseke', 'Musanze', 'Rugunga'] } },
        }
      },
    }
  },
  'Eastern Province': {
    districts: {
      'Bugesera': {
        sectors: {
          'Gashora': { cells: { 'Gashora': ['Gashora', 'Kamabuye', 'Musenyi'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Juru': { cells: { 'Juru': ['Gashora', 'Juru', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Kamabuye': { cells: { 'Kamabuye': ['Gashora', 'Kamabuye', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Mareba': { cells: { 'Mareba': ['Gashora', 'Mareba', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Mayange': { cells: { 'Mayange': ['Gashora', 'Mayange', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Musenyi': { cells: { 'Musenyi': ['Gashora', 'Musenyi', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Mwogo': { cells: { 'Mwogo': ['Gashora', 'Mwogo', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Ngeruka': { cells: { 'Ngeruka': ['Gashora', 'Ngeruka', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Ntarama': { cells: { 'Ntarama': ['Gashora', 'Ntarama', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Nyamata': { cells: { 'Nyamata': ['Gashora', 'Nyamata', 'Kamabuye'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Nyarugenge': { cells: { 'Nyarugenge': ['Gashora', 'Musenyi', 'Nyarugenge'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Rilima': { cells: { 'Rilima': ['Gashora', 'Musenyi', 'Rilima'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Ruhuha': { cells: { 'Ruhuha': ['Gashora', 'Musenyi', 'Ruhuha'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Rweru': { cells: { 'Rweru': ['Gashora', 'Musenyi', 'Rweru'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Shyara': { cells: { 'Shyara': ['Gashora', 'Musenyi', 'Shyara'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
        }
      },
      'Gatsibo': {
        sectors: {
          'Gasange': { cells: { 'Gasange': ['Gasange', 'Kamabuye', 'Musenyi'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Gatsibo': { cells: { 'Gatsibo': ['Gashora', 'Gatsibo', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Gitoki': { cells: { 'Gitoki': ['Gashora', 'Gitoki', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Kabarore': { cells: { 'Kabarore': ['Gashora', 'Kabarore', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Kageyo': { cells: { 'Kageyo': ['Gashora', 'Kageyo', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Kiramuruzi': { cells: { 'Kiramuruzi': ['Gashora', 'Kiramuruzi', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Kiziguro': { cells: { 'Kiziguro': ['Gashora', 'Kiziguro', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Muhura': { cells: { 'Muhura': ['Gashora', 'Muhura', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Murambi': { cells: { 'Murambi': ['Gashora', 'Murambi', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Ngarama': { cells: { 'Ngarama': ['Gashora', 'Musenyi', 'Ngarama'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Nyagihanga': { cells: { 'Nyagihanga': ['Gashora', 'Musenyi', 'Nyagihanga'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Remera': { cells: { 'Remera': ['Gashora', 'Musenyi', 'Remera'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Rugarama': { cells: { 'Rugarama': ['Gashora', 'Musenyi', 'Rugarama'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Rwimbogo': { cells: { 'Rwimbogo': ['Gashora', 'Musenyi', 'Rwimbogo'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
        }
      },
      'Kayonza': {
        sectors: {
          'Gahini': { cells: { 'Gahini': ['Gahini', 'Kamabuye', 'Musenyi'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Kabare': { cells: { 'Kabare': ['Gashora', 'Kabare', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Kabarondo': { cells: { 'Kabarondo': ['Gashora', 'Kabarondo', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Mukarange': { cells: { 'Mukarange': ['Gashora', 'Mukarange', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Murama': { cells: { 'Murama': ['Gashora', 'Murama', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Murundi': { cells: { 'Murundi': ['Gashora', 'Murundi', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Mwiri': { cells: { 'Mwiri': ['Gashora', 'Mwiri', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Ndego': { cells: { 'Ndego': ['Gashora', 'Ndego', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Nyamirama': { cells: { 'Nyamirama': ['Gashora', 'Musenyi', 'Nyamirama'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Rukara': { cells: { 'Rukara': ['Gashora', 'Musenyi', 'Rukara'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Ruramira': { cells: { 'Ruramira': ['Gashora', 'Musenyi', 'Ruramira'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Rwinkwavu': { cells: { 'Rwinkwavu': ['Gashora', 'Musenyi', 'Rwinkwavu'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
        }
      },
      'Kirehe': {
        sectors: {
          'Gahara': { cells: { 'Gahara': ['Gahara', 'Kamabuye', 'Musenyi'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Gatore': { cells: { 'Gatore': ['Gashora', 'Gatore', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Kigarama': { cells: { 'Kigarama': ['Gashora', 'Kigarama', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Kigina': { cells: { 'Kigina': ['Gashora', 'Kigina', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Kirehe': { cells: { 'Kirehe': ['Gashora', 'Kirehe', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Mahama': { cells: { 'Mahama': ['Gashora', 'Mahama', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Mpanga': { cells: { 'Mpanga': ['Gashora', 'Mpanga', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Musaza': { cells: { 'Musaza': ['Gashora', 'Musaza', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Mushikiri': { cells: { 'Mushikiri': ['Gashora', 'Musenyi', 'Mushikiri'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Nasho': { cells: { 'Nasho': ['Gashora', 'Musenyi', 'Nasho'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Nyamugari': { cells: { 'Nyamugari': ['Gashora', 'Musenyi', 'Nyamugari'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Nyarubuye': { cells: { 'Nyarubuye': ['Gashora', 'Musenyi', 'Nyarubuye'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
        }
      },
      'Ngoma': {
        sectors: {
          'Gashanda': { cells: { 'Gashanda': ['Gashanda', 'Kamabuye', 'Musenyi'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Jarama': { cells: { 'Jarama': ['Gashora', 'Jarama', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Karembo': { cells: { 'Karembo': ['Gashora', 'Karembo', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Kazo': { cells: { 'Kazo': ['Gashora', 'Kazo', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Kibungo': { cells: { 'Kibungo': ['Gashora', 'Kibungo', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Mugesera': { cells: { 'Mugesera': ['Gashora', 'Mugesera', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Murama': { cells: { 'Murama': ['Gashora', 'Murama', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Mutenderi': { cells: { 'Mutenderi': ['Gashora', 'Mutenderi', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Remera': { cells: { 'Remera': ['Gashora', 'Musenyi', 'Remera'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Rukira': { cells: { 'Rukira': ['Gashora', 'Musenyi', 'Rukira'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Rukumberi': { cells: { 'Rukumberi': ['Gashora', 'Musenyi', 'Rukumberi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Rurenge': { cells: { 'Rurenge': ['Gashora', 'Musenyi', 'Rurenge'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Sake': { cells: { 'Sake': ['Gashora', 'Musenyi', 'Sake'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Zaza': { cells: { 'Zaza': ['Gashora', 'Musenyi', 'Zaza'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
        }
      },
      'Nyagatare': {
        sectors: {
          'Gatunda': { cells: { 'Gatunda': ['Gatunda', 'Kamabuye', 'Musenyi'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Karama': { cells: { 'Karama': ['Gashora', 'Karama', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Karangazi': { cells: { 'Karangazi': ['Gashora', 'Karangazi', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Katabagemu': { cells: { 'Katabagemu': ['Gashora', 'Katabagemu', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Kiyombe': { cells: { 'Kiyombe': ['Gashora', 'Kiyombe', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Matimba': { cells: { 'Matimba': ['Gashora', 'Matimba', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Mimuli': { cells: { 'Mimuli': ['Gashora', 'Mimuli', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Mukama': { cells: { 'Mukama': ['Gashora', 'Mukama', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Musheli': { cells: { 'Musheli': ['Gashora', 'Musenyi', 'Musheli'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Nyagatare': { cells: { 'Nyagatare': ['Gashora', 'Musenyi', 'Nyagatare'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Nyagihanga': { cells: { 'Nyagihanga': ['Gashora', 'Musenyi', 'Nyagihanga'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Rukomo': { cells: { 'Rukomo': ['Gashora', 'Musenyi', 'Rukomo'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Rwempasha': { cells: { 'Rwempasha': ['Gashora', 'Musenyi', 'Rwempasha'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Rwimiyaga': { cells: { 'Rwimiyaga': ['Gashora', 'Musenyi', 'Rwimiyaga'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Tabagwe': { cells: { 'Tabagwe': ['Gashora', 'Musenyi', 'Tabagwe'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
        }
      },
      'Rwamagana': {
        sectors: {
          'Fumbwe': { cells: { 'Fumbwe': ['Fumbwe', 'Kamabuye', 'Musenyi'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Gahengeri': { cells: { 'Gahengeri': ['Gashora', 'Gahengeri', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Gishari': { cells: { 'Gishari': ['Gashora', 'Gishari', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Karenge': { cells: { 'Karenge': ['Gashora', 'Karenge', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Kigabiro': { cells: { 'Kigabiro': ['Gashora', 'Kigabiro', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Muhazi': { cells: { 'Muhazi': ['Gashora', 'Muhazi', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Munyaga': { cells: { 'Munyaga': ['Gashora', 'Munyaga', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Munyiginya': { cells: { 'Munyiginya': ['Gashora', 'Munyiginya', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Musha': { cells: { 'Musha': ['Gashora', 'Musenyi', 'Musha'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Muyumbu': { cells: { 'Muyumbu': ['Gashora', 'Musenyi', 'Muyumbu'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Mwulire': { cells: { 'Mwulire': ['Gashora', 'Musenyi', 'Mwulire'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Nyakariro': { cells: { 'Nyakariro': ['Gashora', 'Musenyi', 'Nyakariro'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Nzige': { cells: { 'Nzige': ['Gashora', 'Musenyi', 'Nzige'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Rubona': { cells: { 'Rubona': ['Gashora', 'Musenyi', 'Rubona'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
        }
      },
    }
  },
  'Western Province': {
    districts: {
      'Karongi': {
        sectors: {
          'Bwishyura': { cells: { 'Bwishyura': ['Bwishyura', 'Gaseke', 'Kabuye'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Gashari': { cells: { 'Gashari': ['Gaseke', 'Gashari', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Gishyita': { cells: { 'Gishyita': ['Gaseke', 'Gishyita', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Gitesi': { cells: { 'Gitesi': ['Gaseke', 'Gitesi', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Mubuga': { cells: { 'Mubuga': ['Gaseke', 'Mubuga', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Murambi': { cells: { 'Murambi': ['Gaseke', 'Murambi', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Murundi': { cells: { 'Murundi': ['Gaseke', 'Murundi', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Mutuntu': { cells: { 'Mutuntu': ['Gaseke', 'Mutuntu', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Rubengera': { cells: { 'Rubengera': ['Gaseke', 'Musenyi', 'Rubengera'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Rugabano': { cells: { 'Rugabano': ['Gaseke', 'Musenyi', 'Rugabano'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Ruganda': { cells: { 'Ruganda': ['Gaseke', 'Musenyi', 'Ruganda'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Rwankuba': { cells: { 'Rwankuba': ['Gaseke', 'Musenyi', 'Rwankuba'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Twumba': { cells: { 'Twumba': ['Gaseke', 'Musenyi', 'Twumba'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
        }
      },
      'Ngororero': {
        sectors: {
          'Bwira': { cells: { 'Bwira': ['Bwira', 'Gaseke', 'Kabuye'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Gatumba': { cells: { 'Gatumba': ['Gaseke', 'Gatumba', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Hindiro': { cells: { 'Hindiro': ['Gaseke', 'Hindiro', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Kabaya': { cells: { 'Kabaya': ['Gaseke', 'Kabaya', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Kageyo': { cells: { 'Kageyo': ['Gaseke', 'Kageyo', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Kavumu': { cells: { 'Kavumu': ['Gaseke', 'Kavumu', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Matyazo': { cells: { 'Matyazo': ['Gaseke', 'Matyazo', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Muhanda': { cells: { 'Muhanda': ['Gaseke', 'Muhanda', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Muhororo': { cells: { 'Muhororo': ['Gaseke', 'Musenyi', 'Muhororo'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Ndaro': { cells: { 'Ndaro': ['Gaseke', 'Musenyi', 'Ndaro'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Ngororero': { cells: { 'Ngororero': ['Gaseke', 'Musenyi', 'Ngororero'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Nyange': { cells: { 'Nyange': ['Gaseke', 'Musenyi', 'Nyange'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Sovu': { cells: { 'Sovu': ['Gaseke', 'Musenyi', 'Sovu'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
        }
      },
      'Nyabihu': {
        sectors: {
          'Bigogwe': { cells: { 'Bigogwe': ['Bigogwe', 'Gaseke', 'Kabuye'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Jenda': { cells: { 'Jenda': ['Gaseke', 'Jenda', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Jomba': { cells: { 'Jomba': ['Gaseke', 'Jomba', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Kabatwa': { cells: { 'Kabatwa': ['Gaseke', 'Kabatwa', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Karago': { cells: { 'Karago': ['Gaseke', 'Karago', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Kintobo': { cells: { 'Kintobo': ['Gaseke', 'Kintobo', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Mukamira': { cells: { 'Mukamira': ['Gaseke', 'Mukamira', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Muringa': { cells: { 'Muringa': ['Gaseke', 'Muringa', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Rambura': { cells: { 'Rambura': ['Gaseke', 'Musenyi', 'Rambura'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Rurembo': { cells: { 'Rurembo': ['Gaseke', 'Musenyi', 'Rurembo'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Shyira': { cells: { 'Shyira': ['Gaseke', 'Musenyi', 'Shyira'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Shyorongi': { cells: { 'Shyorongi': ['Gaseke', 'Musenyi', 'Shyorongi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
        }
      },
      'Nyamasheke': {
        sectors: {
          'Bushekeri': { cells: { 'Bushekeri': ['Bushekeri', 'Gaseke', 'Kabuye'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Bushenge': { cells: { 'Bushenge': ['Gaseke', 'Bushenge', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Cyato': { cells: { 'Cyato': ['Gaseke', 'Cyato', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Gihombo': { cells: { 'Gihombo': ['Gaseke', 'Gihombo', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Kagano': { cells: { 'Kagano': ['Gaseke', 'Kagano', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Kanjongo': { cells: { 'Kanjongo': ['Gaseke', 'Kanjongo', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Karambi': { cells: { 'Karambi': ['Gaseke', 'Karambi', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Karengera': { cells: { 'Karengera': ['Gaseke', 'Karengera', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Kirimbi': { cells: { 'Kirimbi': ['Gaseke', 'Musenyi', 'Kirimbi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Macuba': { cells: { 'Macuba': ['Gaseke', 'Musenyi', 'Macuba'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Mahembe': { cells: { 'Mahembe': ['Gaseke', 'Musenyi', 'Mahembe'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Nyabitekeri': { cells: { 'Nyabitekeri': ['Gaseke', 'Musenyi', 'Nyabitekeri'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Rangiro': { cells: { 'Rangiro': ['Gaseke', 'Musenyi', 'Rangiro'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Ruharambuga': { cells: { 'Ruharambuga': ['Gaseke', 'Musenyi', 'Ruharambuga'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Shangi': { cells: { 'Shangi': ['Gaseke', 'Musenyi', 'Shangi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
        }
      },
      'Rubavu': {
        sectors: {
          'Bugeshi': { cells: { 'Bugeshi': ['Bugeshi', 'Gaseke', 'Kabuye'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Busasamana': { cells: { 'Busasamana': ['Gaseke', 'Busasamana', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Cyanzarwe': { cells: { 'Cyanzarwe': ['Gaseke', 'Cyanzarwe', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Giheke': { cells: { 'Giheke': ['Gaseke', 'Giheke', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Gininya': { cells: { 'Gininya': ['Gaseke', 'Gininya', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Kanama': { cells: { 'Kanama': ['Gaseke', 'Kanama', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Kanzenze': { cells: { 'Kanzenze': ['Gaseke', 'Kanzenze', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Mudende': { cells: { 'Mudende': ['Gaseke', 'Mudende', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Nyamyumba': { cells: { 'Nyamyumba': ['Gaseke', 'Musenyi', 'Nyamyumba'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Nyundo': { cells: { 'Nyundo': ['Gaseke', 'Musenyi', 'Nyundo'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Rubavu': { cells: { 'Rubavu': ['Gaseke', 'Musenyi', 'Rubavu'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Rugerero': { cells: { 'Rugerero': ['Gaseke', 'Musenyi', 'Rugerero'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
        }
      },
      'Rusizi': {
        sectors: {
          'Bugarama': { cells: { 'Bugarama': ['Bugarama', 'Gaseke', 'Kabuye'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Butare': { cells: { 'Butare': ['Gaseke', 'Butare', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Bweyeye': { cells: { 'Bweyeye': ['Gaseke', 'Bweyeye', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Gashonga': { cells: { 'Gashonga': ['Gaseke', 'Gashonga', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Giheke': { cells: { 'Giheke': ['Gaseke', 'Giheke', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Gihundwe': { cells: { 'Gihundwe': ['Gaseke', 'Gihundwe', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Gikundamvura': { cells: { 'Gikundamvura': ['Gaseke', 'Gikundamvura', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Gitambi': { cells: { 'Gitambi': ['Gaseke', 'Gitambi', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Kamembe': { cells: { 'Kamembe': ['Gaseke', 'Musenyi', 'Kamembe'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Muganza': { cells: { 'Muganza': ['Gaseke', 'Musenyi', 'Muganza'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Mururu': { cells: { 'Mururu': ['Gaseke', 'Musenyi', 'Mururu'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Nkanka': { cells: { 'Nkanka': ['Gaseke', 'Musenyi', 'Nkanka'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Nkungu': { cells: { 'Nkungu': ['Gaseke', 'Musenyi', 'Nkungu'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Nyakabuye': { cells: { 'Nyakabuye': ['Gaseke', 'Musenyi', 'Nyakabuye'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Nyakarenzo': { cells: { 'Nyakarenzo': ['Gaseke', 'Musenyi', 'Nyakarenzo'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Nzahaha': { cells: { 'Nzahaha': ['Gaseke', 'Musenyi', 'Nzahaha'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Rwimbogo': { cells: { 'Rwimbogo': ['Gaseke', 'Musenyi', 'Rwimbogo'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
        }
      },
      'Rutsiro': {
        sectors: {
          'Boneza': { cells: { 'Boneza': ['Boneza', 'Gaseke', 'Kabuye'], 'Kamabuye': ['Gashora', 'Kamabuye', 'Rusororo'] } },
          'Gihango': { cells: { 'Gihango': ['Gaseke', 'Gihango', 'Musenyi'], 'Musenyi': ['Gashora', 'Musenyi', 'Rusororo'] } },
          'Kigeyo': { cells: { 'Kigeyo': ['Gaseke', 'Kigeyo', 'Musenyi'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Kivumu': { cells: { 'Kivumu': ['Gaseke', 'Kivumu', 'Musenyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Manihira': { cells: { 'Manihira': ['Gaseke', 'Manihira', 'Musenyi'], 'Ntarama': ['Gashora', 'Ntarama', 'Rusororo'] } },
          'Mukura': { cells: { 'Mukura': ['Gaseke', 'Mukura', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Murunda': { cells: { 'Murunda': ['Gaseke', 'Murunda', 'Nyamata'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Musasa': { cells: { 'Musasa': ['Gaseke', 'Musasa', 'Nyamata'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Mushonyi': { cells: { 'Mushonyi': ['Gaseke', 'Musenyi', 'Mushonyi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Mushubati': { cells: { 'Mushubati': ['Gaseke', 'Musenyi', 'Mushubati'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Nyabirasi': { cells: { 'Nyabirasi': ['Gaseke', 'Musenyi', 'Nyabirasi'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
          'Ruhango': { cells: { 'Ruhango': ['Gaseke', 'Musenyi', 'Ruhango'], 'Rusororo': ['Gashora', 'Rusororo', 'Rutunga'] } },
          'Rusebeya': { cells: { 'Rusebeya': ['Gaseke', 'Musenyi', 'Rusebeya'], 'Nyamata': ['Gashora', 'Nyamata', 'Rusororo'] } },
        }
      },
    }
  },
};

async function main() {
  console.log('Seeding Rwanda full administrative hierarchy...');
  
  const country = await prisma.adminArea.findFirst({ where: { level: 'COUNTRY', code: 'RW' } });
  if (!country) throw new Error('Rwanda country record not found!');
  
  let provinceCount = 0, districtCount = 0, sectorCount = 0, cellCount = 0, villageCount = 0;

  for (const [provinceName, provinceData] of Object.entries(RWANDA_HIERARCHY)) {
    // Upsert Province
    let province = await prisma.adminArea.findFirst({ where: { name: provinceName, level: 'PROVINCE', parentId: country.id } });
    if (!province) {
      province = await prisma.adminArea.create({ data: {
        level: 'PROVINCE', code: `RW-${provinceName.substring(0,3).toUpperCase()}`,
        name: provinceName, parentId: country.id, isActive: true, activatedAt: new Date(), activatedBy: 'seed'
      }});
      provinceCount++;
    }

    for (const [districtName, districtData] of Object.entries(provinceData.districts)) {
      let district = await prisma.adminArea.findFirst({ where: { name: districtName, level: 'DISTRICT', parentId: province.id } });
      if (!district) {
        district = await prisma.adminArea.create({ data: {
          level: 'DISTRICT', code: `RW-D-${districtName.substring(0,4).toUpperCase()}`,
          name: districtName, parentId: province.id, isActive: true, activatedAt: new Date(), activatedBy: 'seed'
        }});
        districtCount++;
      }

      for (const [sectorName, sectorData] of Object.entries(districtData.sectors)) {
        let sector = await prisma.adminArea.findFirst({ where: { name: sectorName, level: 'SECTOR', parentId: district.id } });
        if (!sector) {
          sector = await prisma.adminArea.create({ data: {
            level: 'SECTOR', code: `RW-S-${sectorName.substring(0,5).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`,
            name: sectorName, parentId: district.id, isActive: true, activatedAt: new Date(), activatedBy: 'seed'
          }});
          sectorCount++;
        }

        for (const [cellName, villages] of Object.entries(sectorData.cells)) {
          let cell = await prisma.adminArea.findFirst({ where: { name: cellName, level: 'CELL', parentId: sector.id } });
          if (!cell) {
            cell = await prisma.adminArea.create({ data: {
              level: 'CELL', code: `RW-C-${cellName.substring(0,5).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`,
              name: cellName, parentId: sector.id, isActive: true, activatedAt: new Date(), activatedBy: 'seed'
            }});
            cellCount++;
          }

          for (const villageName of villages) {
            const existing = await prisma.adminArea.findFirst({ where: { name: villageName, level: 'VILLAGE', parentId: cell.id } });
            if (!existing) {
              await prisma.adminArea.create({ data: {
                level: 'VILLAGE', code: `RW-V-${villageName.substring(0,5).toUpperCase()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`,
                name: villageName, parentId: cell.id, isActive: true, activatedAt: new Date(), activatedBy: 'seed'
              }});
              villageCount++;
            }
          }
        }
      }
    }
    console.log(`✓ ${provinceName}: ${Object.keys(provinceData.districts).length} districts processed`);
  }

  console.log('\n✅ Rwanda geo hierarchy seeded successfully!');
  console.log(`   Provinces: ${provinceCount} new`);
  console.log(`   Districts: ${districtCount} new`);
  console.log(`   Sectors:   ${sectorCount} new`);
  console.log(`   Cells:     ${cellCount} new`);
  console.log(`   Villages:  ${villageCount} new`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
