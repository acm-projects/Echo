import {View, Text, Image, StyleSheet, TouchableOpacity, Alert, ScrollView} from 'react-native';
import Feather from '@react-native-vector-icons/feather';
import { useRouter } from 'expo-router';
import {ProgressBar} from './ProgressBar';
import { useWindowDimensions } from 'react-native';

type BookCardProps ={
    title: string;
    author: string;
    coverImage: string;
    progress: number;
    totalTime: number;
}


export default function BookCard({title, author, coverImage, progress, totalTime}: BookCardProps) {
    const percent = (progress !== null && totalTime > 0) ? (progress / totalTime) * 100 : 0;
    const {width, height} = useWindowDimensions();
    const totalHours = Math.floor(totalTime / 60);
    const totalMinutes = totalTime % 60;
    const progressHours = Math.floor(progress / 60);
    const progressMinutes = progress % 60;
    return (
        <View style={[styles.card, {width: width * 0.9}]}>
            <Image source={{uri: coverImage}} style={styles.coverImage} />
            <View style={styles.infoContainer}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.author}>{author}</Text>
                <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 5,}}>
                    <Feather name="clock" size={16} color="#555" />
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 5, justifyContent: 'space-between', flex: 1}}>
                    <Text style={{marginLeft: 5, fontSize: 14, color: '#555'}}>
                        {progressHours == 0 ? '' : `${progressHours} hr `}{progressMinutes} min read of {totalHours == 0 ? '' : `${totalHours} hr `}{totalMinutes} min
                    </Text>
                    <Text style ={{marginLeft: 5, fontSize: 14, color: '#555'}}>
                        {percent.toFixed(0)}% 
                    </Text>
                    </View>
                </View>
                <ProgressBar percent={percent} />
            </View>
        </View>
    );
    
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 10,
        marginVertical: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    coverImage: {
        width: 60,
        height: 90,
        borderRadius: 4,
    },
    infoContainer: {
        flex: 1,
        marginLeft: 10,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
    }, author: {
        fontSize: 14,
        color: '#555',
        marginBottom: 5,
    },    
})